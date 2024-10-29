import { MouseEventHandler } from 'react'
import { CloseOutlined, SaveOutlined } from '@ant-design/icons'

export default function FileHeader({ onMouseDown }: { onMouseDown: MouseEventHandler<HTMLDivElement> }) {
  return (
    <div
      style={{
        background: '#282C34',
        padding: 15,
        borderBottom: '3px solid #fff',
        display: 'flex',
        justifyContent: 'space-between'
      }}
      onMouseDown={onMouseDown}
    >
      <div style={{ color: '#fff', fontSize: 20, userSelect: 'none' }}>script.js</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <SaveOutlined style={{ color: '#fff', fontSize: 20, cursor: 'pointer' }} />
        <CloseOutlined style={{ color: '#fff', fontSize: 20, cursor: 'pointer' }} />
      </div>
    </div>
  )
}
