import React from 'react'

type Props = {
  onLogout: () => void
}

export default function LogoutButton({ onLogout }: Props) {
  const handleClick = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout()
    }
  }

  return (
    <button onClick={handleClick} className="btn btn-danger">
      Logout
    </button>
  )
}
