declare module 'victory-native' {
  import React from 'react';
  
  export interface VictoryAxisProps {
    dependentAxis?: boolean;
    domain?: [number, number] | { x?: [number, number]; y?: [number, number] };
    label?: string;
    orientation?: 'top' | 'bottom' | 'left' | 'right';
    padding?: number | { top?: number; bottom?: number; left?: number; right?: number };
    scale?: 'linear' | 'time' | 'log' | 'sqrt';
    standalone?: boolean;
    style?: {
      axis?: React.CSSProperties;
      axisLabel?: React.CSSProperties;
      grid?: React.CSSProperties;
      ticks?: React.CSSProperties;
      tickLabels?: React.CSSProperties;
    };
    tickCount?: number;
    tickFormat?: any;
    tickValues?: any[];
    width?: number;
    height?: number;
  }

  export interface VictoryChartProps {
    children?: React.ReactNode;
    domain?: { x?: [number, number]; y?: [number, number] };
    domainPadding?: number | { x?: number | [number, number]; y?: number | [number, number] };
    height?: number;
    padding?: number | { top?: number; bottom?: number; left?: number; right?: number };
    scale?: 'linear' | 'time' | 'log' | 'sqrt';
    standalone?: boolean;
    width?: number;
    containerComponent?: React.ReactElement;
    theme?: any;
  }

  export interface VictoryLineProps {
    data?: Array<{ x: string | number | Date; y: string | number | Date }>;
    domain?: { x?: [number, number]; y?: [number, number] };
    interpolation?: 'linear' | 'natural' | 'basis' | 'cardinal' | 'monotoneX' | 'monotoneY' | 'step' | 'stepAfter' | 'stepBefore';
    padding?: number | { top?: number; bottom?: number; left?: number; right?: number };
    samples?: number;
    scale?: 'linear' | 'time' | 'log' | 'sqrt';
    standalone?: boolean;
    style?: {
      data?: React.CSSProperties;
      labels?: React.CSSProperties;
      parent?: React.CSSProperties;
    };
    width?: number;
    height?: number;
    x?: string | ((data: any) => number | string | Date);
    y?: string | ((data: any) => number | string | Date);
  }

  export interface VictoryScatterProps {
    data?: Array<{ x: string | number | Date; y: string | number | Date }>;
    domain?: { x?: [number, number]; y?: [number, number] };
    size?: number;
    symbol?: 'circle' | 'diamond' | 'plus' | 'minus' | 'square' | 'star' | 'triangleDown' | 'triangleUp';
    style?: {
      data?: React.CSSProperties;
      labels?: React.CSSProperties;
      parent?: React.CSSProperties;
    };
    width?: number;
    height?: number;
  }

  export interface VictoryLegendProps {
    data?: Array<{
      name?: string;
      symbol?: {
        fill?: string;
        type?: string;
      };
    }>;
    standalone?: boolean;
    orientation?: 'horizontal' | 'vertical';
    gutter?: number | { left?: number; right?: number };
    style?: {
      data?: React.CSSProperties;
      labels?: React.CSSProperties;
      parent?: React.CSSProperties;
    };
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }

  export class VictoryAxis extends React.Component<VictoryAxisProps> {}
  export class VictoryChart extends React.Component<VictoryChartProps> {}
  export class VictoryLine extends React.Component<VictoryLineProps> {}
  export class VictoryScatter extends React.Component<VictoryScatterProps> {}
  export class VictoryLegend extends React.Component<VictoryLegendProps> {}
} 