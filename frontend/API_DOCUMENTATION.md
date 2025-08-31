# Blockchain Service API Documentation

基于 `test-api.js` 测试文件整理的完整API文档

## 基础配置

- **Base URL**: `http://localhost:3001`
- **Content-Type**: `application/json`
- **Timeout**: 60秒

## 系统状态检查

### 1. 健康检查

**端点**: `GET /health`

**描述**: 检查服务健康状态

**请求示例**:
```http
GET /health
```

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. 区块链状态检查

**端点**: `GET /blockchain/status`

**描述**: 检查区块链连接状态

**请求示例**:
```http
GET /blockchain/status
```

**响应示例**:
```json
{
  "connected": true,
  "network": "sepolia",
  "blockNumber": 12345
}
```

## 用户管理

### 3. 用户注册

**端点**: `POST /api/user/register`

**描述**: 注册新用户

**请求体**:
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "testPassword123"
}
```

**响应示例**:
```json
{
  "success": true,
  "userId": "user_123",
  "message": "User registered successfully"
}
```

### 4. 用户认证

**端点**: `POST /api/user/authenticate`

**描述**: 用户登录认证

**请求体**:
```json
{
  "password": "testPassword123"
}
```

**响应示例**:
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_123",
    "name": "Test User"
  }
}
```

### 5. 获取用户信息

**端点**: `GET /api/user/{userAddress}`

**描述**: 获取指定用户的详细信息

**路径参数**:
- `userAddress`: 用户的以太坊地址

**请求示例**:
```http
GET /api/user/0x0BBe0E741C165952307aD4901A5804704849C81c
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "address": "0x0BBe0E741C165952307aD4901A5804704849C81c",
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

## 工作人员管理

### 6. 工作人员注册

**端点**: `POST /api/delivery-tracking/register-worker`

**描述**: 注册新的配送工作人员

**请求体**:
```json
{
  "workerAddress": "0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC",
  "name": "Test Worker",
  "workerType": "admin"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "workerAddress": "0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC",
    "name": "Test Worker",
    "workerType": "admin",
    "registeredAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 7. 获取工作人员信息

**端点**: `GET /api/delivery-tracking/worker/{workerAddress}`

**描述**: 获取指定工作人员的详细信息

**路径参数**:
- `workerAddress`: 工作人员的以太坊地址

**请求示例**:
```http
GET /api/delivery-tracking/worker/0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "workerAddress": "0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC",
    "name": "Test Worker",
    "workerType": "admin",
    "isActive": true
  }
}
```

## 邮件管理

### 8. 邮件注册

**端点**: `POST /api/mail/register`

**描述**: 注册新的邮件包裹

**请求体**:
```json
{
  "mailId": "MAIL_1234567890_ABCD1234",
  "trackingNumber": "TN1234567890",
  "senderAddress": "0x0BBe0E741C165952307aD4901A5804704849C81c",
  "recipientId": "RECIPIENT_BOB_001",
  "mailType": "package",
  "guaranteedDeliveryTime": 1640995200,
  "requiresTimeProof": true,
  "metadata": {
    "weight": "2.5kg",
    "size": "Medium",
    "priority": 1,
    "insurance": "0.01",
    "requiresSignature": true
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mailId": "MAIL_1234567890_ABCD1234",
    "trackingNumber": "TN1234567890",
    "status": "registered",
    "registeredAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 9. 获取邮件详情

**端点**: `GET /api/mail/{mailId}/details`

**描述**: 获取指定邮件的详细信息

**路径参数**:
- `mailId`: 邮件唯一标识符

**请求示例**:
```http
GET /api/mail/MAIL_1234567890_ABCD1234/details
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mailId": "MAIL_1234567890_ABCD1234",
    "trackingNumber": "TN1234567890",
    "senderAddress": "0x0BBe0E741C165952307aD4901A5804704849C81c",
    "recipientId": "RECIPIENT_BOB_001",
    "mailType": "package",
    "status": "in_transit",
    "metadata": {
      "weight": "2.5kg",
      "size": "Medium"
    }
  }
}
```

## 配送跟踪

### 10. 更新配送状态

**端点**: `POST /api/delivery-tracking/update-status`

**描述**: 更新邮件的配送状态

**请求体**:
```json
{
  "trackingNumber": "TN1234567890",
  "location": "Collection Center - NYC",
  "coordinates": {
    "latitude": 40712800,
    "longitude": -74006000
  },
  "status": "collected",
  "signature": "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
  "timeData": {
    "ntpServer": "time.google.com",
    "atomicTime": 1640995200,
    "timezone": "UTC"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "trackingNumber": "TN1234567890",
    "status": "collected",
    "location": "Collection Center - NYC",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 11. 获取配送历史

**端点**: `GET /api/delivery-tracking/delivery-history/{mailId}`

**描述**: 获取指定邮件的配送历史记录

**路径参数**:
- `mailId`: 邮件唯一标识符

**请求示例**:
```http
GET /api/delivery-tracking/delivery-history/MAIL_1234567890_ABCD1234
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mailId": "MAIL_1234567890_ABCD1234",
    "history": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "status": "collected",
        "location": "Collection Center - NYC",
        "coordinates": {
          "latitude": 40712800,
          "longitude": -74006000
        }
      }
    ]
  }
}
```

### 12. 获取配送性能

**端点**: `GET /api/delivery-tracking/performance`

**描述**: 获取配送性能统计数据

**请求示例**:
```http
GET /api/delivery-tracking/performance
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalDeliveries": 1000,
    "onTimeDeliveries": 950,
    "averageDeliveryTime": 24.5,
    "performanceRate": 95.0
  }
}
```

### 13. 获取性能指标

**端点**: `GET /api/delivery-tracking/metrics`

**描述**: 获取详细的性能指标

**请求示例**:
```http
GET /api/delivery-tracking/metrics
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "dailyMetrics": {
      "deliveries": 50,
      "onTime": 48,
      "delayed": 2
    },
    "weeklyMetrics": {
      "deliveries": 350,
      "onTime": 330,
      "delayed": 20
    }
  }
}
```

## 时间证明

### 14. 生成时间证明

**端点**: `POST /api/proof/generate-time-proof`

**描述**: 为指定邮件生成时间证明

**请求体**:
```json
{
  "mailId": "MAIL_1234567890_ABCD1234",
  "location": "Test Location",
  "eventType": "pickup",
  "requestedBy": "0x0BBe0E741C165952307aD4901A5804704849C81c"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "proof": {
      "proofHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "location": "Test Location",
      "eventType": "pickup"
    }
  }
}
```

### 15. 验证时间证明

**端点**: `GET /api/proof/verify/{proofHash}`

**描述**: 验证指定的时间证明

**路径参数**:
- `proofHash`: 时间证明的哈希值

**请求示例**:
```http
GET /api/proof/verify/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "proof": {
      "proofHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "location": "Test Location",
      "eventType": "pickup",
      "verifiedAt": "2024-01-01T00:05:00.000Z"
    }
  }
}
```

## 配送保证

### 16. 创建配送保证

**端点**: `POST /api/guarantee/create`

**描述**: 为邮件创建配送保证

**请求体**:
```json
{
  "mailId": "MAIL_1234567890_ABCD1234",
  "penaltyAmount": "0.1",
  "insurance": "0.15",
  "guaranteedDeliveryTime": 1640995200,
  "escalationContacts": ["0x0BBe0E741C165952307aD4901A5804704849C81c"]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "guaranteeId": "GUARANTEE_1234567890_ABCD1234",
    "mailId": "MAIL_1234567890_ABCD1234",
    "penaltyAmount": "0.1",
    "insurance": "0.15",
    "guaranteedDeliveryTime": "2024-01-01T00:00:00.000Z",
    "transactionHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 17. 获取保证详情

**端点**: `GET /api/guarantee/{guaranteeId}`

**描述**: 获取指定保证的详细信息

**路径参数**:
- `guaranteeId`: 保证唯一标识符

**请求示例**:
```http
GET /api/guarantee/GUARANTEE_1234567890_ABCD1234
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "guaranteeId": "GUARANTEE_1234567890_ABCD1234",
    "mailId": "MAIL_1234567890_ABCD1234",
    "guaranteedDeliveryTime": 1640995200,
    "penaltyAmount": "100000000000000000",
    "insurance": "0x0BBe0E741C165952307aD4901A5804704849C81c",
    "status": 0,
    "createdAt": 1640995200,
    "deliveredAt": 0,
    "isActive": true,
    "retrievedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 18. 更新保证状态

**端点**: `PUT /api/guarantee/{guaranteeId}/status`

**描述**: 更新指定保证的状态

**路径参数**:
- `guaranteeId`: 保证唯一标识符

**请求体**:
```json
{
  "actualDeliveryTime": 1640995200,
  "deliveredOnTime": true
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "guaranteeId": "GUARANTEE_1234567890_ABCD1234",
    "status": "delivered",
    "actualDeliveryTime": "2024-01-01T00:00:00.000Z",
    "deliveredOnTime": true,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 19. 获取保证统计

**端点**: `GET /api/guarantee/stats`

**描述**: 获取配送保证的统计信息

**请求示例**:
```http
GET /api/guarantee/stats
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalGuarantees": 1000,
    "activeGuarantees": 200,
    "deliveredGuarantees": 750,
    "expiredGuarantees": 50,
    "penaltiesClaimed": 15,
    "totalInsurancePool": "125.50",
    "totalPenaltiesPaid": "7.25",
    "averageDeliveryTime": 36,
    "onTimeDeliveryRate": "92.5",
    "disputeRate": "3.2",
    "retrievedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## 测试配置

### 默认测试数据

```javascript
const testData = {
  userAddress: '0x0BBe0E741C165952307aD4901A5804704849C81c',
  privateKey: '8d8db61b3868caf9edb8d09718483d47698ebdfbb137971f828aef8889816be1',
  name: 'Test User',
  email: 'test@example.com',
  password: 'testPassword123',
  mailId: 'MAIL_1234567890_ABCD1234',
  trackingNumber: 'TN1234567890',
  guaranteeId: 'GUARANTEE_1234567890_ABCD1234',
  workerAddress: '0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC'
};
```

### 状态码说明

- `200`: 请求成功
- `400`: 请求参数错误
- `401`: 未授权访问
- `404`: 资源未找到
- `500`: 服务器内部错误

### 通用响应格式

成功响应:
```json
{
  "success": true,
  "data": {
    // 具体数据内容
  }
}
```

错误响应:
```json
{
  "success": false,
  "error": "错误描述",
  "message": "详细错误信息"
}
```

## 注意事项

1. 所有时间戳使用Unix时间戳格式（秒）
2. 以太坊地址必须是有效的42字符十六进制格式
3. 金额字段使用字符串格式以避免精度丢失
4. 坐标使用整数格式（实际值 × 1,000,000）
5. 签名字段使用十六进制格式
6. 所有API调用都有60秒超时限制

---

*此文档基于 `test-api.js` 文件自动生成，最后更新时间：2024-01-01*