/**
 * Circuit Breaker Pattern Implementation for ML Services
 * Provides fault tolerance and graceful degradation
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  recoveryTimeout: number; // Time in ms before attempting recovery
  monitoringWindow: number; // Time window for failure counting
  successThreshold: number; // Successes needed to close circuit from half-open
  maxRetries: number; // Maximum retry attempts
  retryDelay: number; // Base delay between retries in ms
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  uptime: number; // Percentage
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitState: CircuitState,
    public readonly organizationId?: string
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker implementation for protecting ML services
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private readonly failures: Date[] = []; // Track failures within monitoring window

  constructor(
    public readonly name: string,
    public readonly organizationId: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit should remain open
    if (this.state === CircuitState.OPEN) {
      if (!this.shouldAttemptReset()) {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.name} (org: ${this.organizationId})`,
          this.state,
          this.organizationId
        );
      }
      // Transition to half-open for testing
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(operation);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if circuit is open
        if (error instanceof CircuitBreakerError) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Calculate exponential backoff delay
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
        const totalDelay = delay + jitter;
        
        console.warn(
          `Retry attempt ${attempt + 1}/${maxRetries} for ${this.name} ` +
          `(org: ${this.organizationId}) after ${totalDelay.toFixed(0)}ms delay. Error: ${lastError.message}`
        );
        
        await this.sleep(totalDelay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.totalSuccesses++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // Close circuit if enough successes
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.failures.length = 0;
        console.log(`Circuit breaker CLOSED for ${this.name} (org: ${this.organizationId})`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.lastFailureTime = new Date();
    this.totalFailures++;
    this.failures.push(new Date());
    
    // Clean up old failures outside monitoring window
    this.cleanupOldFailures();
    
    // Count recent failures
    const recentFailures = this.failures.length;
    this.failureCount = recentFailures;
    
    // Open circuit if threshold exceeded
    if (this.state === CircuitState.CLOSED && recentFailures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      
      console.error(
        `Circuit breaker OPENED for ${this.name} (org: ${this.organizationId}) ` +
        `after ${recentFailures} failures. Next attempt at: ${this.nextAttemptTime.toISOString()}`
      );
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Return to open state on failure during half-open
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      
      console.error(
        `Circuit breaker returned to OPEN for ${this.name} (org: ${this.organizationId}) ` +
        `due to failure during half-open state`
      );
    }
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== null && new Date() >= this.nextAttemptTime;
  }

  /**
   * Clean up failures outside monitoring window
   */
  private cleanupOldFailures(): void {
    const cutoffTime = new Date(Date.now() - this.config.monitoringWindow);
    let index = 0;
    
    while (index < this.failures.length && this.failures[index] < cutoffTime) {
      index++;
    }
    
    if (index > 0) {
      this.failures.splice(0, index);
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanupOldFailures();
    
    const uptime = this.totalRequests > 0 
      ? (this.totalSuccesses / this.totalRequests) * 100 
      : 100;
    
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime: Math.round(uptime * 100) / 100
    };
  }

  /**
   * Force circuit state (for testing or manual intervention)
   */
  forceState(state: CircuitState): void {
    console.warn(`Forcing circuit breaker state to ${state} for ${this.name} (org: ${this.organizationId})`);
    this.state = state;
    
    if (state === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.failures.length = 0;
      this.nextAttemptTime = null;
    } else if (state === CircuitState.OPEN) {
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.failures.length = 0;
    
    console.log(`Circuit breaker RESET for ${this.name} (org: ${this.organizationId})`);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker Manager for handling multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  
  private constructor() {}
  
  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }
  
  /**
   * Get or create circuit breaker for organization and service
   */
  getCircuitBreaker(
    serviceName: string,
    organizationId: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const key = `${serviceName}-${organizationId}`;
    
    if (!this.circuitBreakers.has(key)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringWindow: 300000, // 5 minutes
        successThreshold: 3,
        maxRetries: 3,
        retryDelay: 1000 // 1 second
      };
      
      const finalConfig = { ...defaultConfig, ...config };
      const circuitBreaker = new CircuitBreaker(serviceName, organizationId, finalConfig);
      this.circuitBreakers.set(key, circuitBreaker);
    }
    
    return this.circuitBreakers.get(key)!;
  }
  
  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }
  
  /**
   * Get circuit breakers for specific organization
   */
  getCircuitBreakersForOrganization(organizationId: string): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values())
      .filter(cb => cb.organizationId === organizationId);
  }
  
  /**
   * Reset all circuit breakers for organization
   */
  resetOrganizationCircuitBreakers(organizationId: string): void {
    this.getCircuitBreakersForOrganization(organizationId)
      .forEach(cb => cb.reset());
  }
  
  /**
   * Get system-wide circuit breaker statistics
   */
  getSystemStats(): {
    totalCircuitBreakers: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    organizationStats: Record<string, {
      total: number;
      open: number;
      halfOpen: number;
      closed: number;
    }>;
  } {
    const stats = {
      totalCircuitBreakers: this.circuitBreakers.size,
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 0,
      organizationStats: {} as Record<string, any>
    };
    
    for (const cb of this.circuitBreakers.values()) {
      const cbStats = cb.getStats();
      
      // System totals
      switch (cbStats.state) {
        case CircuitState.OPEN:
          stats.openCircuits++;
          break;
        case CircuitState.HALF_OPEN:
          stats.halfOpenCircuits++;
          break;
        case CircuitState.CLOSED:
          stats.closedCircuits++;
          break;
      }
      
      // Organization stats
      if (!stats.organizationStats[cb.organizationId]) {
        stats.organizationStats[cb.organizationId] = {
          total: 0,
          open: 0,
          halfOpen: 0,
          closed: 0
        };
      }
      
      const orgStats = stats.organizationStats[cb.organizationId];
      orgStats.total++;
      
      switch (cbStats.state) {
        case CircuitState.OPEN:
          orgStats.open++;
          break;
        case CircuitState.HALF_OPEN:
          orgStats.halfOpen++;
          break;
        case CircuitState.CLOSED:
          orgStats.closed++;
          break;
      }
    }
    
    return stats;
  }
}