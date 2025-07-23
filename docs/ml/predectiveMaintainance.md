# Eagle Notifier Predictive Maintenance Implementation

## Backend Implementation (Node.js/Express)

### 1. Data Processor Service (`services/dataProcessor.js`)
```javascript
const createDataProcessor = () => {
  let history = [];
  const MAX_HISTORY = 300;

  const generateLagFeatures = () => {
    const features = {};
    if(history.length > 60) {
      features.oilpv_lag_60 = history[60].oilpv;
      features.tz1pv_lag_120 = history[120].tz1pv;
    }
    return features;
  };

  const calculateRollingStats = () => {
    if(history.length < 300) return {};
    const oilValues = history.slice(0, 300).map(d => d.oilpv);
    const oilAvg = oilValues.reduce((sum, val) => sum + val, 0) / 300;
    return { oil_rolling_avg: oilAvg };
  };

  const processData = (data) => {
    history = [data, ...history].slice(0, MAX_HISTORY);
    
    return {
      ...data,
      ...generateLagFeatures(),
      ...calculateRollingStats(),
      oiltemphigh: data.oiltemphigh ? 1 : 0
    };
  };

  return { processData };
};

module.exports = createDataProcessor();
```

### 2. Rule Engine (`models/ruleEngine.js`)
```javascript
const checkCriticalRules = (features) => {
  const alerts = [];
  
  // Oil pressure critical drop
  if (features.oilpv < 30 && 
      features.oilpv_lag_60 && 
      (features.oilpv_lag_60 - features.oilpv) > 10) {
    alerts.push({
      type: 'CRITICAL',
      component: 'oil_system',
      message: 'Rapid oil pressure drop detected',
      timestamp: new Date()
    });
  }
  
  // Temperature anomaly
  if (features.tz1pv > 550 && 
      features.tz1pv_lag_120 && 
      (features.tz1pv / features.tz1pv_lag_120) > 1.2) {
    alerts.push({
      type: 'WARNING',
      component: 'heating_zone1',
      message: 'Abnormal temperature rise trend',
      timestamp: new Date()
    });
  }
  
  return alerts;
};

module.exports = { checkCriticalRules };
```

### 3. Prediction Service (`services/predictor.js`)
```javascript
const ort = require('onnxruntime-node');
let session = null;

const initializeModel = async () => {
  if (!session) {
    session = await ort.InferenceSession.create('./models/predictive_model.onnx');
  }
};

const predict = async (features) => {
  await initializeModel();
  
  const input = new ort.Tensor('float32', Float32Array.from([
    features.oilpv,
    features.oil_rolling_avg || 0,
    features.oiltemphigh,
    features.tz1pv,
    features.oilpv_lag_60 || 0
  ]), [1, 5]);
  
  const results = await session.run({ input });
  return results.output.data;
};

module.exports = { predict };
```

### 4. Alert Controller (`controllers/alertController.js`)
```javascript
const dataProcessor = require('../services/dataProcessor');
const { checkCriticalRules } = require('../models/ruleEngine');
const { predict } = require('../services/predictor');

const alertCache = new Map();

const deduplicateAlerts = (alerts) => {
  return alerts.filter(alert => !alertCache.has(alert.message));
};

const cacheAlert = (alert) => {
  alertCache.set(alert.message, true);
  setTimeout(() => alertCache.delete(alert.message), 300000);
};

const analyzeData = async (rawData) => {
  try {
    const features = dataProcessor.processData(rawData);
    const ruleAlerts = checkCriticalRules(features);
    let mlAlerts = [];
    
    if (features.oil_rolling_avg !== undefined) {
      const prediction = await predict(features);
      if (prediction[0] > 0.85) {
        mlAlerts.push({
          type: 'PREDICTIVE',
          component: 'oil_system',
          message: 'Oil system failure likely within 5 minutes',
          confidence: prediction[0],
          timestamp: new Date()
        });
      }
    }
    
    const allAlerts = deduplicateAlerts([...ruleAlerts, ...mlAlerts]);
    allAlerts.forEach(cacheAlert);
    
    return allAlerts;
  } catch (error) {
    console.error('Analysis error:', error);
    return [];
  }
};

module.exports = { analyzeData };
```

### 5. Main API Route (`routes/prediction.js`)
```javascript
const express = require('express');
const router = express.Router();
const { analyzeData } = require('../controllers/alertController');

router.post('/analyze', async (req, res) => {
  try {
    const alerts = await analyzeData(req.body);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

module.exports = router;
```

### 6. WebSocket Service (`services/socketService.js`)
```javascript
const socketIO = require('socket.io');

const setupSocket = (server) => {
  const io = socketIO(server);
  
  const broadcastAlert = (alert) => {
    io.emit('new_alert', alert);
  };
  
  return { broadcastAlert };
};

module.exports = setupSocket;
```

## Frontend Implementation (React Native)

### 1. Alert Card Component (`components/AlertCard.js`)
```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ALERT_COLORS = {
  CRITICAL: '#ff6b6b',
  WARNING: '#ffd93d',
  PREDICTIVE: '#6a89cc'
};

const AlertCard = ({ alert }) => (
  <View style={[styles.card, { backgroundColor: ALERT_COLORS[alert.type] }]}>
    <View style={styles.header}>
      <Text style={styles.component}>{alert.component.toUpperCase()}</Text>
      <Text style={styles.type}>{alert.type}</Text>
    </View>
    <Text style={styles.message}>{alert.message}</Text>
    {alert.confidence && (
      <Text style={styles.confidence}>
        Confidence: {(alert.confidence * 100).toFixed(1)}%
      </Text>
    )}
    <Text style={styles.timestamp}>
      {new Date(alert.timestamp).toLocaleTimeString()}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5
  },
  component: {
    fontWeight: 'bold',
    fontSize: 16
  },
  type: {
    fontWeight: 'bold',
    fontSize: 14
  },
  message: {
    marginBottom: 5
  },
  confidence: {
    fontStyle: 'italic'
  },
  timestamp: {
    alignSelf: 'flex-end',
    fontSize: 12
  }
});

export default AlertCard;
```

### 2. Predictive Tab Screen (`screens/PredictiveTab.js`)
```javascript
import React, { useState, useEffect } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import io from 'socket.io-client';
import AlertCard from '../components/AlertCard';

const PredictiveTab = () => {
  const [alerts, setAlerts] = useState([]);
  const SOCKET_URL = 'ws://your-backend-ip:3000';

  useEffect(() => {
    const setupSocket = () => {
      const socket = io(SOCKET_URL);
      
      socket.on('new_alert', (alert) => {
        setAlerts(prev => [{
          ...alert,
          id: `${alert.timestamp}_${alert.component}`
        }, ...prev.slice(0, 49)]);
      });
      
      return () => socket.disconnect();
    };
    
    const socketCleanup = setupSocket();
    return socketCleanup;
  }, []);

  const renderItem = ({ item }) => <AlertCard alert={item} />;

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No active alerts</Text>
      <Text>Monitoring systems...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>ACTIVE ALERTS</Text>
      <FlatList
        data={alerts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f9fa'
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#343a40'
  },
  listContainer: {
    flexGrow: 1
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 10,
    color: '#6c757d'
  }
});

export default PredictiveTab;
```

### 3. Feedback Component (`components/FeedbackButton.js`)
```javascript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';

const FeedbackButton = ({ alertId }) => {
  const sendFeedback = (valid) => {
    // Implement API call to backend
    Alert.alert('Feedback sent', `Marked as ${valid ? 'valid' : 'false'} alert`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Was this alert accurate?</Text>
      <View style={styles.buttonGroup}>
        <TouchableOpacity 
          style={[styles.button, styles.yesButton]}
          onPress={() => sendFeedback(true)}
        >
          <Text style={styles.buttonText}>Yes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.noButton]}
          onPress={() => sendFeedback(false)}
        >
          <Text style={styles.buttonText}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 10
  },
  label: {
    marginBottom: 5,
    color: '#495057'
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 4
  },
  yesButton: {
    backgroundColor: '#40c057'
  },
  noButton: {
    backgroundColor: '#fa5252'
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold'
  }
});

export default FeedbackButton;
```

## Deployment Configuration

### 1. Backend Server Setup (`server.js`)
```javascript
const express = require('express');
const http = require('http');
const setupSocket = require('./services/socketService');
const predictionRouter = require('./routes/prediction');

const app = express();
const server = http.createServer(app);
const io = setupSocket(server);

app.use(express.json());
app.use('/api', predictionRouter);

// Broadcast alerts to clients
const broadcastAlerts = (alerts) => {
  alerts.forEach(alert => io.broadcastAlert(alert));
};

// Make broadcast function available to controllers
app.locals.broadcastAlerts = broadcastAlerts;

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 2. Model Conversion Script (`scripts/convertModel.js`)
```javascript
const lgb = require('lightgbm');
const onnx = require('onnxmltools');

const convertModel = async () => {
  // Load trained LightGBM model
  const model = lgb.Booster.loadModel('model.txt');
  
  // Convert to ONNX
  const onnxModel = onnx.convert_lightgbm(model, {
    name: 'PredictiveMaintenance',
    initial_types: [['input', onnx.FloatTensorType, [null, 20]]]
  });
  
  // Save optimized model
  fs.writeFileSync('./models/predictive_model.onnx', onnxModel.serialize());
};

convertModel();
```

### 3. Package.json Dependencies
```json
{
  "name": "eagle-notifier-backend",
  "dependencies": {
    "express": "^4.18.2",
    "onnxruntime-node": "^1.16.0",
    "socket.io": "^4.7.2",
    "lightgbm": "^3.3.5",
    "onnxmltools": "^1.11.0"
  },
  "scripts": {
    "start": "node server.js",
    "convert-model": "node scripts/convertModel.js"
  }
}
```

## Performance Optimization Tips

### 1. Frontend Optimization
```javascript
// Use React.memo for AlertCard component
export default React.memo(AlertCard);

// Debounce socket events
const debounce = (func, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

// In PredictiveTab.js
useEffect(() => {
  const socket = io(SOCKET_URL);
  
  const debouncedAlertHandler = debounce((alert) => {
    setAlerts(prev => [alert, ...prev.slice(0, 49)]);
  }, 100);
  
  socket.on('new_alert', debouncedAlertHandler);
  
  return () => socket.disconnect();
}, []);
```

### 2. Backend Optimization
```javascript
// Use worker threads for prediction
const { Worker } = require('worker_threads');

const predictWithWorker = (features) => {
  return new Promise((resolve) => {
    const worker = new Worker('./services/predictionWorker.js', {
      workerData: features
    });
    
    worker.on('message', resolve);
  });
};

// Update prediction service
const predict = async (features) => {
  if (process.env.NODE_ENV === 'production') {
    return predictWithWorker(features);
  }
  // ... existing implementation
};
```

### 3. Model Quantization
```bash
# Convert to optimized ORT format
python -m onnxruntime.tools.convert_onnx_models_to_ort \
  --onnx_model_path ./model.onnx \
  --output_dir ./optimized_models
```

## Implementation Checklist

1. [ ] Set up Node.js backend with Express
2. [ ] Convert trained LightGBM model to ONNX format
3. [ ] Implement data processing pipeline
4. [ ] Create rule-based alert system
5. [ ] Integrate ONNX runtime for predictions
6. [ ] Set up WebSocket communication
7. [ ] Build React Native alert interface
8. [ ] Add alert feedback mechanism
9. [ ] Implement performance monitoring
10. [ ] Set up automated model retraining

## Maintenance Plan

1. **Weekly Model Updates:**
```javascript
// models/updateModel.js
const cron = require('node-cron');
const retrainModel = require('./retrainModel');

cron.schedule('0 3 * * 0', () => { // 3AM every Sunday
  retrainModel();
  console.log('Model retrained and updated');
});
```

2. **Alert Accuracy Tracking:**
```javascript
// controllers/feedbackController.js
const trackAlertAccuracy = (alertId, valid) => {
  // Store in database
  db.collection('alert_feedback').insertOne({
    alertId,
    valid,
    timestamp: new Date()
  });
  
  // Calculate weekly accuracy
  calculateAccuracyMetrics();
};
```

3. **Performance Monitoring:**
```javascript
// Add to analyzeData function
const start = Date.now();
// ... analysis code ...
const duration = Date.now() - start;
trackPerformance({ duration, alertCount: allAlerts.length });
```

This implementation provides:
- Complete predictive maintenance pipeline
- Real-time alerting with WebSockets
- Hybrid rule-based + ML approach
- Optimized for mobile performance
- Modular and maintainable code structure
- Feedback loop for continuous improvement
```

This document provides a complete implementation plan with:
1. Functional programming style throughout
2. Short, focused functions
3. React functional components with hooks
4. Modular backend services
5. Performance optimization techniques
6. Complete deployment configuration
7. Maintenance and monitoring plan

All components are designed for easy integration into your existing React Native/Node.js stack with minimal dependencies.