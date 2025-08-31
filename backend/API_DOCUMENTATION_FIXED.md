# 修复版 Blockchain Service API Documentation

基于实际代码修正的完整API文档

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
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "blockchain-service",
  "version": "1.0.0"
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
  "success": true,
  "data": {
    "network": {
      "name": "sepolia",
      "chainId": "11155111"
    },
    "signer": {
      "address": "0x...",
      "balance": "1.5"
    },
    "blockNumber": 12345,
    "contracts": ["userRegistry", "mailRegistry", "deliveryTracking", "timeProof", "deliveryGuarantee"]
  }
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
  "password": "testPassword123",
  "userAddress": "0x0BBe0E741C165952307aD4901A5804704849C81c"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": "user_1693728000_abc123def",
  "data": {
    "userAddress": "0x0BBe0E741C165952307aD4901A5804704849C81c",
    "name": "Test User",
    "email": "test@example.com",
    "transactionHash": "0x...",
    "blockNumber": 9123456,
    "registrationTime": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. 用户认证

**端点**: `POST /api/user/authenticate`

**描述**: 用户登录认证

**请求体**:
```json
{
  "password": "testPassword123",
  "userAddress": "0x0BBe0E741C165952307aD4901A5804704849C81c"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "User authenticated successfully",
  "data": {
    "userAddress": "0x0BBe0E741C165952307aD4901A5804704849C81c",
    "authenticated": true,
    "name": "Test User",
    "email": "test@example.com",
    "userId": "user_123",
    "transactionHash": "0x...",
    "blockNumber": 9123456,
    "loginTime": "2024-01-01T00:00:00.000Z"
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
    "userAddress": "0x0BBe0E741C165952307aD4901A5804704849C81c",
    "name": "Test User",
    "email": "test@example.com",
    "isActive": true,
    "registrationTime": "2024-01-01T00:00:00.000Z",
    "userId": "user_123"
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
  "message": "Worker registered successfully",
  "data": {
    "workerAddress": "0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC",
    "name": "Test Worker",
    "workerType": "admin",
    "transactionHash": "0x...",
    "blockNumber": 9123456,
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
    "isRegistered": true,
    "name": "Test Worker",
    "workerType": "admin",
    "registrationTime": "1640995200"
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
  "message": "Mail registered successfully",
  "data": {
    "mailId": "MAIL_1234567890_ABCD1234",
    "trackingNumber": "TN1234567890",
    "status": "registered",
    "registeredAt": "2024-01-01T00:00:00.000Z",
    "transactionHash": "0x...",
    "blockNumber": 9123456,
    "gasUsed": "500000"
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
    "status": 1,
    "registrationTime": "2024-01-01T00:00:00.000Z",
    "lastUpdateTime": "2024-01-01T00:00:00.000Z",
    "guaranteedDeliveryTime": "2024-01-01T00:00:00.000Z",
    "proofOfTimeRequired": true,
    "metadataHash": "0x..."
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
    "latitude": 40.7128,
    "longitude": -74.0060
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
  "message": "Delivery status updated successfully",
  "data": {
    "trackingNumber": "TN1234567890",
    "status": "collected",
    "location": "Collection Center - NYC",
    "coordinates": {
      "latitude": 40712800,
      "longitude": -74006000
    },
    "transactionHash": "0x...",
    "blockNumber": 9123456,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "updateId": "update_1693728000_xyz789"
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
    "trackingHistory": [
      {
        "status": "collected",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "location": "Collection Center - NYC",
        "coordinates": {
          "latitude": 40712800,
          "longitude": -74006000
        },
        "signature": "0x",
        "updateId": "update_1693728000_xyz789"
      }
    ],
    "totalUpdates": 1
  }
}
```

### 12. 获取当前配送状态

**端点**: `GET /api/delivery-tracking/current-status/{mailId}`

**描述**: 获取指定邮件的当前配送状态

**路径参数**:
- `mailId`: 邮件唯一标识符

**请求示例**:
```http
GET /api/delivery-tracking/current-status/MAIL_1234567890_ABCD1234
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mailId": "MAIL_1234567890_ABCD1234",
    "currentStatus": {
      "status": "in_transit",
      "statusCode": 2,
      "location": "Distribution Center",
      "coordinates": {
        "latitude": 40712800,
        "longitude": -74006000
      },
      "lastUpdated": "2024-01-01T00:00:00.000Z",
      "updateId": "update_1693728000_xyz789"
    }
  }
}
```

### 13. 获取配送性能

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
    "delayedDeliveries": 50,
    "averageDeliveryTime": 24,
    "successRate": "0.95",
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

### 14. 获取性能指标

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
    "dailyDeliveries": 50,
    "weeklyDeliveries": 350,
    "monthlyDeliveries": 1500,
    "averageProcessingTime": 12,
    "customerSatisfaction": "8.5",
    "workerEfficiency": "0.92",
    "lastCalculated": "2024-01-01T00:00:00.000Z"
  }
}
```

## 通用响应格式说明

### 成功响应格式:
```json
{
  "success": true,
  "message": "操作描述（可选）",
  "data": {
    // 具体数据内容
  }
}
```

### 错误响应格式:
```json
{
  "success": false,
  "error": "错误描述",
  "details": "详细错误信息（可选）"
}
```

## 重要修复说明

### 已修复的问题:

1. **用户认证API**: 现在要求`userAddress`字段，响应格式统一使用`{success: true, data: {...}}`
2. **区块链状态API**: 响应格式已统一，包含完整的网络、签名者和合约信息
3. **配送状态坐标**: 统一使用整数格式（实际值×1,000,000）进行存储和传输
4. **邮件注册响应**: 添加了`status`和`registeredAt`字段
5. **健康检查**: 包含完整的服务信息（service、version字段）

### 坐标格式说明:

- **输入**: 使用标准浮点数格式（如 40.7128, -74.0060）
- **存储/传输**: 自动转换为整数格式（如 40712800, -74006000）
- **显示**: API响应中返回整数格式，前端需要除以1,000,000还原

### 状态码说明

- `200`: 请求成功
- `400`: 请求参数错误
- `401`: 未授权访问
- `404`: 资源未找到
- `500`: 服务器内部错误

---

*此文档基于实际代码修正，确保文档与代码实现的一致性*