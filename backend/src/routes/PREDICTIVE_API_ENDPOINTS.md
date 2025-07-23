# Predictive Maintenance API Endpoints

This document describes the API endpoints implemented for the predictive maintenance system in the Eagle Notifier platform.

## Overview

The predictive maintenance API provides comprehensive endpoints for:
- Real-time predictions and batch processing
- Model management and monitoring
- Training pipeline control
- Real-time streaming of predictions and alerts
- Performance metrics and analytics

All endpoints are organization-scoped and require proper authentication.

## Base URL
```
/api/predictive-alerts
```

## Authentication
All endpoints require authentication via JWT token. Some endpoints require specific roles:
- `ADMIN` - Organization administrators
- `SUPER_ADMIN` - System-wide administrators

## New Endpoints Added

### Batch Prediction Processing

#### POST /predict/batch
Process multiple prediction requests in a single API call.

**Request Body:**
```json
{
  "predictions": [
    {
      "features": {
        "temperature": 85.5,
        "pressure": 120.3,
        "vibration": 0.8
      },
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "source": "sensor_1"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "index": 0,
        "success": true,
        "data": {
          "probability": 0.85,
          "confidence": 0.92,
          "predictedComponent": "Heating System",
          "timeToFailure": 8
        }
      }
    ],
    "statistics": {
      "total": 1,
      "successful": 1,
      "failed": 0,
      "successRate": 100
    }
  }
}
```

**Limits:**
- Maximum 100 predictions per batch
- Each prediction must include a features object

#### POST /predict/scada
Process raw SCADA data and return prediction.

**Request Body:**
```json
{
  "scadaData": {
    "temperature": 87.5,
    "pressure": 125.3,
    "flow_rate": 45.2,
    "vibration": 1.2
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prediction": {
      "probability": 0.78,
      "confidence": 0.85,
      "predictedComponent": "Cooling System",
      "timeToFailure": 12
    },
    "processedFeatures": {
      "featureCount": 24,
      "processingTime": 45,
      "lagFeatureCount": 8,
      "rollingFeatureCount": 12
    }
  }
}
```

### Real-time Streaming Endpoints

#### GET /stream/predictions
Real-time prediction streaming using Server-Sent Events (SSE).

**Query Parameters:**
- `interval` (optional): Update interval in milliseconds (1000-60000, default: 5000)

**Response Format (SSE):**
```
data: {"type":"connected","organizationId":"org-123","timestamp":"2024-01-15T10:30:00Z","interval":5000}

data: {"type":"prediction","organizationId":"org-123","timestamp":"2024-01-15T10:30:05Z","data":{"probability":0.82,"confidence":0.88}}

data: {"type":"heartbeat","timestamp":"2024-01-15T10:30:10Z"}
```

**Event Types:**
- `connected` - Initial connection established
- `prediction` - New prediction result
- `heartbeat` - Keep-alive signal
- `error` - Error occurred

#### GET /stream/alerts
Real-time alert streaming using Server-Sent Events (SSE).

**Query Parameters:**
- `severity` (optional): Filter by severity level (HIGH, MEDIUM, LOW)

**Response Format (SSE):**
```
data: {"type":"connected","organizationId":"org-123","timestamp":"2024-01-15T10:30:00Z","filters":{"severity":"HIGH"}}

data: {"type":"alert","organizationId":"org-123","timestamp":"2024-01-15T10:30:05Z","data":{"id":"alert-123","probability":0.92,"component":"Heating System"}}
```

### Enhanced Model Management

#### GET /models/info
Get detailed model information for the organization.

**Response:**
```json
{
  "success": true,
  "data": {
    "organization": {
      "id": "org-123",
      "name": "Manufacturing Plant A",
      "modelVersion": "v2024-01-15",
      "modelAccuracy": 0.87,
      "predictionEnabled": true
    },
    "modelMetrics": {
      "accuracy": 0.87,
      "precision": 0.85,
      "recall": 0.89,
      "auc": 0.91
    },
    "cache": {
      "isInCache": true,
      "cacheStats": {
        "size": 3,
        "organizations": ["org-123", "org-456"]
      }
    },
    "recentTraining": [
      {
        "version": "v2024-01-15",
        "status": "COMPLETED",
        "accuracy": 0.87,
        "startedAt": "2024-01-15T02:00:00Z"
      }
    ],
    "recentAccuracy": {
      "accuracy": 89.5,
      "sampleSize": 42,
      "period": "7 days"
    }
  }
}
```

#### POST /models/test
Test model with sample data (Admin/Super Admin only).

**Request Body:**
```json
{
  "testData": {
    "temperature": 85.0,
    "pressure": 120.0,
    "vibration": 0.5
  },
  "iterations": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "iteration": 1,
        "prediction": {
          "probability": 0.82,
          "confidence": 0.88
        },
        "iterationTime": 45
      }
    ],
    "statistics": {
      "iterations": 5,
      "totalTime": 225,
      "averageTime": 45,
      "minTime": 42,
      "maxTime": 48
    }
  }
}
```

### System Administration

#### GET /admin/system-stats
Get system-wide prediction statistics (Super Admin only).

**Query Parameters:**
- `hours` (optional): Time period in hours (default: 24)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "hours": 24,
      "since": "2024-01-14T10:30:00Z"
    },
    "organizations": {
      "total": 15,
      "withPredictions": 12
    },
    "predictions": {
      "total": 1250,
      "withFeedback": 89,
      "accurate": 78,
      "systemAccuracy": 87.6
    },
    "training": {
      "completed": 3,
      "failed": 0,
      "successRate": 100
    },
    "cache": {
      "size": 8,
      "maxSize": 10,
      "organizations": ["org-1", "org-2"]
    },
    "predictionsByOrganization": [
      {
        "organizationId": "org-123",
        "count": 450
      }
    ]
  }
}
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development mode)"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

## Rate Limiting

- Batch prediction: Maximum 100 predictions per request
- Streaming endpoints: Automatic connection management
- Model testing: Maximum 10 iterations per request

## Security Considerations

- All endpoints require valid JWT authentication
- Organization data is strictly isolated
- Super Admin endpoints require elevated permissions
- Streaming connections are automatically cleaned up on disconnect
- Input validation on all request parameters

## Usage Examples

### JavaScript/TypeScript Client

```typescript
// Batch prediction
const batchResponse = await fetch('/api/predictive-alerts/predict/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    predictions: [
      {
        features: { temperature: 85.5, pressure: 120.3 }
      }
    ]
  })
});

// Real-time streaming
const eventSource = new EventSource('/api/predictive-alerts/stream/predictions?interval=5000');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'prediction') {
    console.log('New prediction:', data.data);
  }
};
```

### cURL Examples

```bash
# Batch prediction
curl -X POST /api/predictive-alerts/predict/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"predictions":[{"features":{"temperature":85.5}}]}'

# Model information
curl -X GET /api/predictive-alerts/models/info \
  -H "Authorization: Bearer $TOKEN"

# System statistics (Super Admin)
curl -X GET /api/predictive-alerts/admin/system-stats?hours=48 \
  -H "Authorization: Bearer $TOKEN"
```

## Integration Notes

- These endpoints integrate seamlessly with existing predictive maintenance services
- All endpoints respect organization boundaries and user permissions
- Streaming endpoints use Server-Sent Events for broad browser compatibility
- Batch processing optimizes performance for high-volume prediction scenarios
- Model management endpoints provide comprehensive monitoring capabilities