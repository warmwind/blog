---
title: 使用 Amazon Bedrock AgentCore Identity 在 Amazon ECS 上保护 AI Agent 的安全
pubDatetime: 2026-05-07T11:00:00+08:00
description: 介绍如何在 Amazon ECS 上实现 Authorization Code Grant（三方 OAuth）并结合 Amazon Bedrock AgentCore Identity，通过安全会话绑定和作用域 token 保护 AI Agent 对外部服务的访问。
slug: bedrock-agentcore-identity-ecs-oauth-zh
originalTitle: "Secure AI agents with Amazon Bedrock AgentCore Identity on Amazon ECS"
originalUrl: https://aws.amazon.com/blogs/machine-learning/secure-ai-agents-with-amazon-bedrock-agentcore-identity-on-amazon-ecs/
tags:
  - AI
  - AWS
  - AgentCore
  - Security
  - OAuth
  - ECS
---

原文标题：Secure AI agents with Amazon Bedrock AgentCore Identity on Amazon ECS<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/secure-ai-agents-with-amazon-bedrock-agentcore-identity-on-amazon-ecs/

生产环境中的 AI Agent 需要安全地访问外部服务。Amazon Bedrock AgentCore Identity 作为一项独立服务提供，无论你的 AI Agent 运行在 Amazon ECS、Amazon EKS、AWS Lambda 等计算平台还是本地环境，都能保护其对外部服务的访问安全。

早前的一篇文章介绍了 AgentCore Identity 的凭证管理功能。在 ECS 等计算环境上运行 Agent 会引出两个问题：如何构建应用自有的 Session Binding 端点，以及如何管理工作负载访问 token 的生命周期？

本文在 Amazon ECS 上实现了带有安全会话绑定的 Authorization Code Grant（三方 OAuth），并提供了一个可运行的实现，包含：

- 防止 CSRF 和浏览器交换攻击的安全会话绑定
- 遵循最小权限原则、作用域于每个用户会话的认证 token
- Agent 工作负载与 Session Binding 服务之间的关注点分离

## 使用 OAuth 2.0 和 OIDC 进行身份认证与授权

该方案使用 OAuth 2.0（RFC 6749）和 OpenID Connect（OIDC）。OIDC 用于用户身份认证（确认用户是谁），OAuth 2.0 用于授权（确认用户可以做什么）。

我们聚焦于用于用户委托访问的 Authorization Code Grant。用户向身份提供商进行身份认证并授予同意。应用程序随后将授权码换取访问 token，从而创建审计追踪。在此流程中，用户向身份提供商进行身份认证，并授权 Agent 代表其访问特定资源。应用程序将所得到的授权码换取作用域访问 token，Amazon Bedrock AgentCore Identity 将其安全地存储在 token 保险库中。由于每个 token 都绑定到具有明确同意的特定用户身份，该方案可以维护从用户认证到 Agent 操作的完整审计链。

Authorization Code Grant 适用于代表用户行事的 Agentic 工作负载，因为它在 Agent 行动之前提供用户同意，通过会话绑定验证发起授权请求的用户与授予同意的用户是同一用户，并通过作用域委托将 Agent 限制在用户批准的权限范围内。

## 回调 URL 与 Session Binding URL 的区别

在此场景中，Authorization Code Grant 流程使用了两个经常被混淆的 URL：

- **回调 URL（Callback URL）**：在 AgentCore Identity 中创建 OAuth 客户端时自动生成。它指向 AgentCore Identity，必须在授权服务器处注册为重定向目标，用于在用户认证后接收授权码。
- **Session Binding URL**：指向客户托管服务的 URL，用于完成经过认证的用户与 OAuth 流程之间的会话绑定。该端点由客户自行实现和托管。

## 解决方案概述

此架构图展示了 AgentCore Identity 如何保护 Amazon ECS 上自托管 AI Agent 的安全。本演练使用 Microsoft Entra ID 作为身份提供商，但也支持其他符合 OIDC 规范的提供商。此演练的完整源代码和前提条件可在配套的 GitHub 仓库中获取。

该方案在 Amazon ECS 上部署了两个服务，位于应用程序负载均衡器之后。**Agentic 工作负载**运行 AI Agent 并处理用户请求。**Session Binding 服务**处理 OAuth 回调，将用户会话与第三方访问 token 关联起来。两个服务都使用 Amazon Bedrock AgentCore Identity，通过 OIDC 对入站用户进行身份认证，并代表用户授权出站操作。图中带编号的注释对应以下描述。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/ML-20517-image-1.png)

- **入站身份认证和流量路由**：请求到达 Amazon Application Load Balancer（ALB），ALB 通过其内置的 OIDC 认证流程对用户进行身份认证。流量使用来自 AWS Certificate Manager 的证书加密 HTTPS，Amazon Route 53 公共托管区中的别名 A 记录将流量路由到负载均衡器。通过 OIDC 完成用户认证后，ALB 将请求转发至 Amazon ECS 集群。ALB 注入一个以 JWT 格式包含用户声明的 `x-amzn-oidc-data` 头，其中 `sub` 字段唯一标识用户。
- **Agentic 工作负载**：Agentic 工作负载暴露一个 FastAPI 服务器，带有接受 `sessionId` 和 `message` 的 `/invocations` 端点。FastAPI 服务器将这些传递给使用 Strands Agents 构建的 Agent。你也可以使用 LangChain 或其他 Agent SDK，因为服务器独立于 Agent 框架处理请求。Agent 调用 Amazon Bedrock 上的大型语言模型（LLM），也可以使用其他模型提供商。Agent 将会话状态存储在 Amazon S3 存储桶中，并以用户的 `sub` 声明作为键前缀来隔离不同用户之间的会话。Agent 还具有代表用户在 GitHub 上执行操作的工具，这需要用户的 OAuth 访问 token。
- **使用 AgentCore Identity 进行出站身份认证**：当 Agent 需要代表用户在 GitHub 等第三方服务中执行操作时，它通过 AgentCore Identity 请求 OAuth 访问 token。如果不存在有效 token，AgentCore Identity 将发起 Authorization Code Grant 流程，提示用户授权访问。
- **OAuth 回调处理**：在用户授权访问后，Session Binding 服务通过 AgentCore Identity 将授权绑定到正确的用户会话，完成 OAuth 流程。
- **用户界面**：托管 Agentic 工作负载的 FastAPI 服务器暴露一个 `/docs` 端点，将 OpenAPI 规范渲染为交互式 HTML 页面。终端用户通过此页面与 Agent 交互，该页面为演示提供了最简 UI。

Amazon CloudWatch 捕获日志，专用的 S3 存储桶存储负载均衡器和数据存储桶的访问日志。ECS 从 Amazon ECR 中拉取容器镜像。负载均衡器附加了一组基本的 AWS WAF 规则，以提供针对常见 Web 漏洞的基线防护。Amazon KMS 客户托管密钥（CMK）对数据进行加密，访问日志存储桶除外——该存储桶需要 Amazon S3 托管加密（SSE-S3）。

## Amazon Bedrock AgentCore Identity：Authorization Code Grant

本演练针对使用 ALB 进行认证、专用 Session Binding 服务和直接 API 调用（而非 AgentCore SDK 和 Runtime）的自托管架构，对通用的 AgentCore Identity 会话绑定流程进行了适配。

序列图展示了 AgentCore Identity 的工作负载身份、工作负载访问 token 和 OAuth 2.0 凭证提供商如何协同工作，代表用户安全地向 Agent 提供 OAuth token。此流程假设经过认证的用户尚未授权 Agent 访问其资源，即 AgentCore Identity Token Vault 中不存在有效 token。

## ![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/ML-20517-image-2.png)

- 经过认证的用户向 Agentic 工作负载发送请求。Agentic 工作负载从 ALB 签名的 JWT（`x-amzn-oidc-data` 头）中的 `sub` 声明提取用户 ID，以识别用户。
- Agentic 工作负载调用 `GetWorkloadAccessTokenForUserId` API，传入 `userId` 和 `workloadName`，获取代表该用户范围内 Agent 身份的工作负载访问 token。
- AgentCore Identity 将工作负载访问 token 返回给 Agentic 工作负载。
- Agentic 工作负载调用 `GetResourceOauth2Token` API，传入工作负载访问 token、已配置的 OAuth 2.0 凭证提供商名称、Session Binding URL（见 `callbackUrl` 参数），以及所需的作用域（例如 GitHub 的 `read:user` 作用域）。这会为第三方服务（此例为 GitHub）请求 OAuth token。
- 由于该用户不存在有效 token，AgentCore Identity 创建一个 `sessionURI`，用于在 OAuth 2.0 认证过程中后续请求和响应期间追踪授权流程状态。
- AgentCore Identity 将授权 URL 和 session URI 返回给工作负载。
- Agentic 工作负载将授权 URL 返回给用户，提示其授权访问。
- 用户点击授权 URL，在第三方提供商的同意界面中授予 Agent 权限。
- 授权服务器将授权码发送至 AgentCore Identity。
- AgentCore Identity 将用户重定向至附有 session URI 的 Session Binding URL，将其路由至 Session Binding 服务。
- 用户的浏览器通过 Session Binding URL 跟随重定向至 Session Binding 服务。ALB 在 `x-amzn-oidc-data` 头中注入 JWT。
- Session Binding 服务使用 session URI 和用户 ID（从 JWT 中提取）调用 `CompleteResourceTokenAuth` API，将完成的授权绑定到正确的用户会话。成功后，它返回一个静态的应用自有 HTML 页面，确认授权成功。
- AgentCore Identity 与授权服务器交换授权码以获取 OAuth2 访问 token。
- 授权服务器返回 OAuth2 访问 token。
- AgentCore Identity 将 token 存储在 Token Vault 中。
- AgentCore Identity 将成功信息返回给 Session Binding 服务。
- Session Binding 服务向用户显示"授权完成"。

在后续请求中，用户是否需要重新授权取决于授权服务器颁发的凭证。AgentCore Identity 在 Token Vault 中同时存储访问 token 和刷新 token（如果可用）。当存在刷新 token 时——例如 GitHub 在启用用户到服务器 token 过期功能时——AgentCore Identity 会在原始访问 token 过期后自动使用它获取新的访问 token，无需再次提示用户。如果没有颁发刷新 token 且访问 token 过期，系统将提示用户重新授权。请注意，token 也可能被提供商端吊销；在这种情况下，将 `forceAuthentication: true` 设置为强制全新认证流程。

**会话绑定：**

会话绑定可防御两种安全威胁：

**跨站请求伪造（CSRF）**：攻击者尝试将自己的 OAuth token 绑定到受害者身份，导致受害者的 Agent 在不知情的情况下访问攻击者的资源，从而实现数据渗漏和注入。

**浏览器交换攻击**：攻击者诱骗受害者代表其进行同意，将受害者的 OAuth token 绑定到攻击者的身份，从而授予攻击者直接访问受害者资源的权限。

会话绑定通过确保 Agent 工作负载的用户 ID 与 Session Binding 服务的用户 ID 匹配来防御这两种攻击，两个身份都通过认证链进行密码学验证。

AgentCore Identity 还在 `GetResourceOauth2Token` API 中支持可选的 `customState` 参数，可用于传递密码学随机 nonce，以保护回调端点免受 CSRF 攻击，这符合 OAuth 2.0 规范的建议。

### 为何在 AWS ALB 和 Microsoft Entra ID 中使用 GetWorkloadAccessTokenForUserId

获取工作负载访问 token 的推荐 API 是 `GetWorkloadAccessTokenForJWT`。本方案使用 `GetWorkloadAccessTokenForUserId` 来替代。

`GetWorkloadAccessTokenForJWT` 需要一个可动态验证的 JWT，其签名可在运行时根据颁发者发布的签名密钥进行验证，且 `aud` 声明与你的应用程序匹配。要从 Microsoft Entra ID 获取此类 token，必须在 OIDC 授权请求的作用域中包含你的应用程序 ID，详见 AgentCore Microsoft 入站文档。

然而，这与 AWS ALB OIDC 流程不兼容。

作为其 OIDC 握手的一部分（见 ALB OIDC 文档），ALB 将访问 token 发送到 Entra 的 UserInfo 端点以获取经认证用户的声明，这是 ALB 认证流程中的强制步骤。该 UserInfo 端点托管在 Microsoft Graph 上（`https://graph.microsoft.com/oidc/userinfo`），只接受作用域为 Microsoft Graph 的 token。当在作用域中包含应用程序 ID 时，所得到的访问 token 以你的应用程序为受众，UserInfo 端点会以 401 拒绝，ALB 返回 561。

如果从作用域中移除应用程序 ID，Entra 默认将访问 token 受众设为 Microsoft Graph（`00000003-0000-0000-c000-000000000000`）。ALB 握手成功，但生成的 JWT 无法被 AgentCore 动态验证，无法与 `GetWorkloadAccessTokenForJWT` 一起使用。

**本方案的解决思路**：ALB 使用 Graph 作用域 token 完成其握手。ALB 在 `x-amzn-oidc-data` 头中转发一个 ALB 签名的 JWT，其中包含来自 UserInfo 端点的用户声明，包括唯一标识经认证用户的 `sub` 声明。我们使用 AWS 发布的签名密钥验证此 ALB 签名的 JWT，提取 `sub`，并将其传递给 `GetWorkloadAccessTokenForUserId`。

## 实现

查看 [完整代码 GitHub 仓库](https://github.com/)。

### 获取工作负载访问 token

服务器从 JWT 的 `sub` 声明中提取用户 ID，并向 AgentCore Identity 请求工作负载访问 token。服务器随后使用此 token、会话 ID 和消息代表用户调用 Agent。请注意，此处的会话 ID 指 Agent 的对话会话，而非授权流程中的 OAuth session URI。

```python
@router.post("/invocations")
async def invoke_agent(
 request: InvocationRequest,
 user_id: str = Depends(get_current_user),
 settings: Settings = Depends(get_settings),
 agent_service: AgentService = Depends(get_agent_service),
) -> StreamingResponse:
 """Invoke agent with streaming response."""
 try:
 agentcore = boto3.client("bedrock-agentcore", region_name=settings.identity_aws_region)
 response = agentcore.get_workload_access_token_for_user_id(
 workloadName=settings.workload_identity_name, userId=user_id
 )
 workload_access_token = response["workloadAccessToken"] 
return StreamingResponse(
 content=agent_service.stream_response(
 user_message=request.user_message,
 session_id=request.session_id,
 user_id=user_id,
 workload_access_token=workload_access_token,
 ),
 media_type="text/event-stream",
 )
```

### 请求访问 token

服务器使用 AgentCore SDK 中的 `require_access_token` 装饰器来获取 OAuth 2.0 访问 token，参见"获取 OAuth 2.0 访问 token"文档。我们对该装饰器进行了改造，使其接受工作负载访问 token 作为显式参数，而非在内部解析，从而在保留 SDK 的 token 检索和错误处理逻辑的同时，获得对 token 生命周期管理的直接控制。

```python
def requires_access_token(
 *,
 provider_name: str,
 scopes: list[str],
 auth_flow: Literal["M2M", "USER_FEDERATION"],
 workload_access_token: str | None = None,
 session_binding_url: str | None = None,
 on_auth_url: Callable[[str], Any] | None = None,
 force_authentication: bool = False,
 token_poller: TokenPoller | None = None,
 custom_state: str | None = None,
 custom_parameters: dict[str, str] | None = None,
 into: str = "access_token",
 region: str | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
 """Fetch OAuth2 access token with explicit workload token.

 Args:
 provider_name: The credential provider name
 scopes: OAuth2 scopes to request
 auth_flow: Authentication flow type ("M2M" or "USER_FEDERATION")
 workload_access_token: The workload access token (explicit, not from context)
 session_binding_url: Session Binding URL pointing to the customer-managed service that completes the session binding
 on_auth_url: Handler invoked with the authorization URL when user authorization is required
 force_authentication: Force re-authentication
 token_poller: Custom token poller implementation
 custom_state: State for callback verification
 custom_parameters: Additional OAuth parameters
 into: Parameter name to inject the token into
 region: AWS region

 Returns:
 Decorator function

 """

def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
 client = IdentityClient(region)

 @wraps(func)
 async def wrapper(*args: Any, **kwargs: Any) -> Any:
 try:
 if not workload_access_token:
 raise ValueError("workload_access_token is required")
 token = await client.get_token(
 provider_name=provider_name,
 agent_identity_token=workload_access_token,
 scopes=scopes,
 auth_flow=auth_flow,
 callback_url=session_binding_url,
 on_auth_url=on_auth_url,
 force_authentication=force_authentication,
 token_poller=token_poller,
 custom_state=custom_state,
 custom_parameters=custom_parameters,
 )
 kwargs[into] = token
 return await func(*args, **kwargs)
 except Exception:
 logger.exception("Error in requires_access_token decorator")
 raise

 return wrapper

return decorator
```

工具类使用此装饰器在调用 GitHub API 时提供访问 token。

```python
class GitHubTools:
 """Tools for interacting with GitHub using OAuth authentication."""

def _on_auth_url(self, url: str) -> None:
 """Handle authorization URL by raising AuthorizationRequiredError.

 This URL must be presented to the user to grant access.
 """
 raise AuthorizationRequiredError(provider="GitHub", auth_url=url)

async def _call_github_api(
 self, endpoint: str, scopes: list[str], params: dict | None = None
) -> Any:
 """Make authenticated GitHub API call.

 Raises:
 ApiError: When API call fails

 """

 @requires_access_token(
 provider_name=self.config.provider_name,
 scopes=scopes,
 auth_flow="USER_FEDERATION",
 workload_access_token=self.config.workload_access_token,
 session_binding_url=self.config.session_binding_url,
 on_auth_url=self._on_auth_url,
 region=self.config.aws_region,
 )
 async def make_request(*, access_token: str) -> Any:
 async with httpx.AsyncClient() as client:
 response = await client.get(
 f"{self.config.github_api_base}{endpoint}",
 headers={
 "Authorization": f"Bearer {access_token}",
 "Accept": "application/vnd.github+json",
 "X-GitHub-Api-Version": "2022-11-28",
 },
 params=params or {},
 timeout=10.0,
 )
 response.raise_for_status()
 return response.json()

 try:
 return await make_request()
```

类中的每个工具都使用此方法，如下所示：

```python
from strands import tool
class GitHubTools:
 @tool
 async def get_github_user(self) -> GitHubUser:
 """Get the authenticated GitHub user's profile information.
 
 Use this tool when the user wants to:
 - See their GitHub profile
 - Check who they are authenticated as
 - View their GitHub account details
 Returns:
 GitHub user profile
 Raises:
 ApiError: When API call fails
 """
 result: dict[str, Any] = await self._call_github_api(
 "/user", scopes=["read:user"]
 )
 return GitHubUser.model_validate(result)
```

三个关键设计决策：

- **Pydantic BaseModel 作为返回类型**：`GitHubUser` 和 `GitHubProject` 是 `BaseModel` 的子类。Strands 自动从其 schema 和文档字符串中推导工具描述，为 LLM 提供每个工具返回类型的结构化上下文。
- **类型一致的错误处理**：当不存在 token 且 AgentCore Identity 返回授权 URL 时，`on_auth_url` 回调会抛出 `AuthorizationRequiredError`，而不是返回字符串——声明 `GitHubUser` 为返回类型的工具不能返回 URL。Agent 的流式处理层捕获该异常并将 URL 呈现给用户。
- **每个工具独立作用域**：每个工具只声明其所需的 OAuth 作用域，保持同意与最小权限原则的一致性。

### 完成 OAuth 会话绑定流程

接下来，我们来看 Session Binding 服务。当用户在 GitHub 中授权访问后，GitHub 将用户重定向至 `{session_binding_url}?session_id={session_id}`，其中 `session_id` 对应 AgentCore Identity 在原始授权 URL 中包含的 session URI。这将会话绑定请求与 Agent 发起的特定 OAuth 流程关联起来。

```python
@router.get("/session-binding", response_class=HTMLResponse)
async def oauth_session_binding(
 session_id: str = Query(..., description="Session URI from AgentCore Identity"),
 user_id: str = Depends(get_current_user),
 settings: Settings = Depends(get_settings),
) -> HTMLResponse:
 """Handle OAuth2 session binding from external providers.""" 
 client = boto3.client("bedrock-agentcore", region_name=settings.identity_region)
 
 try:
 client.complete_resource_token_auth(
 sessionUri=session_id,
 userIdentifier={"userId": user_id},
 )
```

服务从 `x-amzn-oidc-data` 头中的 `sub` 声明提取用户 ID，确保整个流程中身份的一致性。然后使用 session URI 和用户 ID 调用 `complete_resource_token_auth`，将生成的访问 token 绑定到正确的用户会话。

## 清理

为避免产生后续费用，当不再需要此方案创建的资源时，请将其删除。请按照清理资源的说明操作。

## 总结

在这篇文章中，你学习了如何使用 Amazon Bedrock AgentCore Identity 保护 Amazon ECS 上 AI Agent 的安全。你了解了入站身份认证如何通过 OIDC 验证用户身份、出站身份认证如何使用会话绑定实现 OAuth 2.0，以及如何将 Session Binding 与 Agent 工作负载分离以实现独立扩展同时防御攻击。该模式适用于不同的计算平台，无论你在 ECS、EKS、Lambda 上还是在 AWS 之外运行 Agent。它还可以扩展到 GitHub 之外的其他 OAuth 2.0 支持服务，如 Jira、Salesforce 或 Google Calendar。后续步骤：

- 在 GitHub 中查看完整代码以了解实现细节
- 将该模式适配到你的 OAuth 提供商，用你的服务替换 GitHub
- 在 AgentCore Identity Samples 仓库中探索更多模式
- 阅读关于 AgentCore Runtime 的托管 Agent 托管文章
- 深入了解 AgentCore Identity 文档

## 关于作者

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/ML-20517-image-3.png)

**Julian Grüber** 是 Amazon Web Services 的数据科学顾问。他与战略客户合作，扩展能够创造业务价值的 GenAI 解决方案，在用例和企业架构层面开展工作。凭借其应用数学、机器学习、商业和云基础设施的背景，Julian 将技术深度与业务成果相结合，应对复杂的 AI/ML 挑战。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/ML-20517-image-4.png)

**Tobias** 在 Amazon Web Services 担任安全顾问，是一名安全工程师。Tobias 将实践性解决方案构建与战略咨询相结合，帮助企业客户加速云转型并实现业务目标。他专注于与战略客户合作，在用例和企业架构层面设计和扩展 GenAI 解决方案。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/ML-20517-image-5.jpeg)

**Satveer Khurpa** 是 Amazon Web Services 的 Amazon Bedrock AgentCore 高级全球专业解决方案架构师，专注于 Agentic AI 安全，重点关注 AgentCore Identity 和安全领域。在此角色中，他利用在云原生架构方面的专业知识帮助客户在不同行业中设计和部署安全的 Agentic AI 系统。Satveer 将其对 Agentic AI 模式、身份与访问管理以及纵深防御安全原则的深刻理解应用于架构可扩展、安全和负责任的基于 Agent 的应用程序，使组织在为自主 AI 工作负载维持强健安全态势的同时，能够开拓新的业务机会。

## 引用

- 原文：[Secure AI agents with Amazon Bedrock AgentCore Identity on Amazon ECS](https://aws.amazon.com/blogs/machine-learning/secure-ai-agents-with-amazon-bedrock-agentcore-identity-on-amazon-ecs/)
