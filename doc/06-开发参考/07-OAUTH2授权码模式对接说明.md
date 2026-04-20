# OAuth2 授权码模式对接说明

## 1. 文档目的

目标效果如下：

1. 应用访问授权地址。
2. 用户被跳转到登录页，输入用户名和密码。
3. 登录成功后，认证服务跳转回应用配置的回调地址。
4. 回调地址中会携带 `code`，如果请求时传了 `state`，也会原样带回。
5. 应用拿到 `code` 后，再调用 token 接口换取 `access_token` 等令牌信息。

---

## 2. 整体流程

OAuth2 授权码模式的完整流程可以理解为以下 6 步：

### 2.1 发起授权

浏览器访问：

```text
http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/authorize?client_id=aitraining-id&response_type=code&scope=openid%20all&state=123&redirect_uri=http://localhost:3000/api/auth/callback
```

#### 2.1.1 参数说明

| 参数名          | 是否必填 | 说明                                                         |
| --------------- | -------- | ------------------------------------------------------------ |
| `client_id`     | 是       | 应用在认证中心注册后的客户端 ID，例如：`aitraining-id`      |
| `response_type` | 是       | 固定传 `code`，表示走授权码模式                              |
| `scope`         | 是       | 申请的授权范围，例如：`openid all`                           |
| `state`         | 否       | 应用自定义透传参数，认证成功后会原样返回，通常用于防重放、防串联请求、保持上下文 |
| `redirect_uri`  | 是       | 登录成功后的回调地址，必须是客户端已注册的合法回调地址，例如：`http://localhost:3000/api/auth/callback` |

### 2.2 用户登录

认证中心展示登录页，用户输入用户名和密码。

### 2.3 登录成功回调

认证中心跳转到：

```text
http://localhost:3000/api/auth/callback?code=xxxxx&state=123
```

### 2.4 服务端换 token

业务服务端提取 `code=xxxxx` 后，以 **POST** 方式访问：

```text
http://leaf-auth-server.dev.jinxin.cloud/auth2/oauth2/token
```

并提交以下参数：

| 参数名          | 示例值                             |
| --------------- | ---------------------------------- |
| `redirect_uri`  | `http://localhost:3000/api/auth/callback`      |
| `grant_type`    | `authorization_code`               |
| `code`          | `xxxxx`                            |
| `client_id`     | `aitraining`                    |
| `client_secret` | `29b9635df0164eb890d99a58ffa7f8f2` |

请求方式为：

- Method：`POST`
- Content-Type：`multipart/form-data`

### 2.5 获取 token 响应

认证中心校验通过后，返回 token 信息。典型返回内容一般会包含：

- `access_token`
- `token_type`
- `expires_in`
- `refresh_token`
- `id_token`
- `scope`

返回内容示例：

```json
{
	"access_token": "eyJraWQiOiJTRUFCT1hEQVRBIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiJhZG1pbiIsImF1ZCI6ImF1dGgtc2VydmVyLWRpa29uZyIsIm5iZiI6MTc2MDk0ODE0OSwic2NvcGUiOlsiYWxsIiwib3BlbmlkIl0sImlzcyI6Imh0dHA6Ly95ankuZGV2LmppbnhpbjIzNC5jbG91ZDo5MDAwL2F1dGgyIiwiZXhwIjoxNzYwOTQ5OTQ5LCJpYXQiOjE3NjA5NDgxNDksImp0aSI6IjM5Y2MyODRmLTg1OGItNGE1Mi04OWIzLTVmY2IxMjkwZWY4NSJ9.AnF98_DM143oM7UOqkEJ3LpilGrfJ6O5l7eIr0pr3KGNVU-PDBST9Dhr8lPVeL72vwOQNLXpAtIJXtWDXNjYcupDpD8H3ZIWHeUCIbmV2osaY8vmpuEK_QpfecwNv2VbvxwS2T74vIOefz6y2A6XiUxjB2ginxVhDOyPH3vOtf2ZY7QQpT6K4GBF64Z8t7A7GtbClDXHlOzM3RJDKsmx-s9NpQeSshBaRnQmnNA7TJrWMRFuXPOPKJ7BcIXqDxFM0an4-I-vGLmLEWEjF-UZDMPso_20rSki-HVEHjpXSw3_SHMEa9be5dX6Nq8HRc0LiJ4IyIhNXVgzhg6YypllYA",
	"refresh_token": "Hmdj4QDznGSufJsMiZ_2Yi8hC1Fq3vTuDplSWJ2Q34Vb-V4Ywr9y0RIYDz-wi5khPj-BsYcZ0aShNrWUYebu5fasYE5Q8nME3nOCzABB3Z-v8b9g8aC-HTKYLPR7YDoo",
	"scope": "all openid",
	"id_token": "eyJraWQiOiJTRUFCT1hEQVRBIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiJhZG1pbiIsImF1ZCI6ImF1dGgtc2VydmVyLWRpa29uZyIsImF6cCI6ImF1dGgtc2VydmVyLWRpa29uZyIsImlzcyI6Imh0dHA6Ly95ankuZGV2LmppbnhpbjIzNC5jbG91ZDo5MDAwL2F1dGgyIiwiZXhwIjoxNzYwOTQ5OTQ5LCJpYXQiOjE3NjA5NDgxNDksImp0aSI6ImNmYTMxYTQ2LTk1M2ItNDhiYy04YjY2LTRlZmNiNzgyNmFhYyJ9.kQ081XsoDbLxYoTHQJVaDvx2pNIVhHEbCasQ3PDXO_Wxby_v-hwsEYgyp2lK1j05XmenumVu9jSPoEExu7wtb1S459S-UmwZi81hGEOi7NK9hNNj2iGlPmYnpnM084rptIu-XoRZqlLVRvTcVXhmaYhtbXcImxjvSLPP7CyVqi3Q-1DGuGZCr4Miqd0Jw-r8LA5aluDU2ZlRypCU8oepipfixdtrRSPrnX2VCZxEUtIAVuCggucBzHr2p85Q5jWtQAoK97mjXfhogoWlIVZv8hTKpvPa750tP_Fe6dewFGxBdyG2x3AuIVDE1VwdSW5ywSfB62R29RQdDGKEDcbHfA",
	"token_type": "Bearer",
	"expires_in": 1800 //秒
}
```

### 2.6 获取 token 后的接口调用

1. 成功拿到 `access_token` 后，后续所有需要登录态的接口请求都应携带 `Authorization: Bearer {access_token}`（也可以同时补充 `seabox_acc_token` Cookie）。
2. 需要获取当前登录用户信息时，再调用 `/auth2/api/v2/user/getLoginUser`。
