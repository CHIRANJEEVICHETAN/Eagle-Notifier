# Eagle Notifier Predictive Maintenance Implementation Guide

## Project Overview
Develop a predictive maintenance system that:
1. Analyzes real-time SCADA data (1 record/second)
2. Predicts critical failures 5-10 minutes in advance
3. Delivers alerts to a React Native mobile app
4. Combines machine learning with rule-based thresholds
5. Processes historical data (1.7M+ records)

## Implementation Roadmap

### Phase 1: Backend Setup (Node.js/Express)
1. **Install required packages:**
   ```bash
   npm install onnxruntime-node socket.io express
   ```

2. **Set up data processing service:**
   - Create `services/dataProcessor.js`
   - This service maintains a 5-minute rolling window of data
   - Generates lag features (60s and 120s delays)
   - Calculates rolling averages (5-minute window)

3. **Implement rule engine:**
   - Create `models/ruleEngine.js`
   - Define critical threshold rules:
     * Rapid oil pressure drop (>10 units in 60s)
     * Abnormal temperature rise (>20% in 120s)
   - Returns immediate alerts for critical conditions

4. **Configure prediction service:**
   - Create `services/predictor.js`
   - Load ONNX model for LightGBM predictions
   - Convert features to model input format
   - Predict failure probabilities (oil system focus)

5. **Create alert controller:**
   - Create `controllers/alertController.js`
   - Process data through rule engine and ML predictor
   - Deduplicate alerts using 5-minute caching
   - Return combined alert payload

6. **Set up WebSocket service:**
   - Create `services/socketService.js`
   - Broadcast alerts to connected clients in real-time
   - Handle multiple concurrent connections

### Phase 2: Frontend Implementation (React Native)
1. **Create Alert Card component:**
   - File: `components/AlertCard.js`
   - Visual design with color-coded alert types:
     * CRITICAL = Red
     * WARNING = Yellow
     * PREDICTIVE = Blue
   - Display component, message, and timestamp

2. **Build Predictive Tab screen:**
   - File: `screens/PredictiveTab.js`
   - Connect to backend via WebSocket
   - Display alerts in reverse chronological order
   - Show empty state when no alerts present

3. **Add feedback mechanism:**
   - File: `components/FeedbackButton.js`
   - Allow users to report false alerts
   - Send feedback to backend for model improvement

### Phase 3: Model Operations
1. **Prepare training data:**
   - Load historical SCADA data
   - Create failure targets (5-minutes ahead)
   - Generate features (lag values, rolling averages)

2. **Train LightGBM model:**
   - Focus on oil system failures first
   - Use GPU acceleration for faster training
   - Validate with time-based split

3. **Convert to optimized ONNX format:**
   ```bash
   python -m onnxruntime.tools.convert_onnx_models_to_ort \
     --onnx_model_path ./model.onnx \
     --output_dir ./optimized_models
   ```
   - Quantize model to reduce size by 4x
   - Ensure Node.js compatibility

### Phase 4: Deployment
1. **Backend configuration:**
   - Port 3000: Main API and WebSocket
   - Port 3001: Data ingestion service
   - Use PM2 for process management

2. **Frontend dependencies:**
   ```json
   {
     "dependencies": {
       "socket.io-client": "^4.7.2",
       "onnxruntime-react-native": "^1.16.0"
     }
   }
   ```

3. **Performance optimization:**
   - Implement WebSocket message debouncing (100ms)
   - Use React.memo for alert components
   - Add worker threads for prediction tasks

### Phase 5: Maintenance & Monitoring
1. **Weekly model updates:**
   - Automated Sunday 3AM retraining
   - A/B testing with 5% traffic
   - Automatic rollback on accuracy drop

2. **Alert tracking:**
   - Log all alerts with timestamps
   - Record user feedback on alert accuracy
   - Calculate weekly precision metrics

3. **Performance monitoring:**
   - Track prediction latency
   - Monitor WebSocket connections
   - Alert on system resource thresholds

## Critical Implementation Notes

### Data Flow Sequence
1. SCADA system sends real-time data
2. Backend processes data through:
   - Data processor (feature engineering)
   - Rule engine (immediate alerts)
   - ML predictor (future failure probability)
3. Combined alerts broadcast via WebSocket
4. React Native app displays alerts
5. User feedback sent to backend

### Key Performance Targets
| Metric                  | Target Value |
|-------------------------|--------------|
| Rule-based alert latency | < 10ms       |
| ML prediction latency   | < 50ms       |
| End-to-end alert delivery | < 100ms      |
| Mobile CPU usage        | < 15%        |
| Model size              | < 5MB        |

### Error Handling Priorities
1. **Data gaps:** Use forward-fill for missing values
2. **Model failures:** Fallback to rule-based alerts
3. **Connection loss:** Implement WebSocket reconnection
4. **High load:** Queue processing during traffic spikes

## Team Responsibilities

### Backend Developer
- Implement data processing pipeline
- Configure ONNX runtime
- Set up WebSocket service
- Create alert API endpoints
- Implement automated retraining

### Frontend Developer
- Build alert interface components
- Implement WebSocket integration
- Design alert visualization
- Add user feedback mechanism
- Optimize mobile performance

### Data Engineer
- Prepare historical datasets
- Design feature engineering pipeline
- Train and validate LightGBM models
- Convert models to optimized ONNX format
- Monitor model performance

## Timeline & Milestones

### Week 1: Core System
- Data processing pipeline
- Rule-based alert system
- Backend API endpoints
- Basic alert UI

### Week 2: ML Integration
- ONNX model integration
- Predictive alerts
- Feedback mechanism
- Performance optimization

### Week 3: Deployment
- Staging environment setup
- Load testing
- Mobile app integration
- Documentation

### Week 4: Monitoring
- Alert tracking system
- Performance monitoring
- First model retraining cycle
- Production deployment

## Success Metrics
1. **Accuracy:** >90% precision on critical alerts
2. **Latency:** <100ms end-to-end alert delivery
3. **Adoption:** >80% of users enable predictive alerts
4. **Impact:** 30% reduction in unplanned downtime

This comprehensive guide provides all necessary instructions to implement the predictive maintenance system. Follow the sequence and specifications outlined to ensure a successful deployment that meets all performance, reliability, and usability requirements.