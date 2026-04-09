import React from 'react'

// UserInfoDialog removed — Eidux user/auth system not used in WebClaw.
function UserInfoDialog({ onClose }: { onClose?: () => void }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <p className="text-gray-600 mb-4">User info not available in WebClaw.</p>
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
      </div>
    </div>
  )
}

export default UserInfoDialog
