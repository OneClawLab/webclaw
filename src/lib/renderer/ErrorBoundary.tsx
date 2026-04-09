import { Component, ReactNode, ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  fallback?: ReactNode                      // 出错时显示的备用 UI，默认简单提示
  onError?: (error: Error, info: ErrorInfo) => void  // 出错时的回调，比如日志上报
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 更新状态触发重新渲染，显示 fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 调用用户传入的错误回调
    if (this.props.onError) {
      this.props.onError(error, info)
    }
    // 你也可以在这里做日志上传
    // console.error('Caught by ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      // 默认简单提示
      return <div style={{ padding: 20, background: '#fee', color: '#900' }}>
        <h2>Oops! Something went wrong.</h2>
        <pre>{this.state.error?.message}</pre>
      </div>
    }
    return this.props.children
  }
}
