import { StopOutlined } from '@ant-design/icons'

export default function Blocked() {
  return (
    <div
      style={{
        fontSize: 45,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 50
      }}
    >
      <StopOutlined style={{ fontSize: 100 }} />
      <div>Your account is blocked</div>
    </div>
  )
}
