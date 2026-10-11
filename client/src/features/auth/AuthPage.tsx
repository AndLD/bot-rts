'use client'

import { useState } from 'react'
import './AuthPage.scss'
import SigninForm from './SigninForm'
import SignupForm from './SignupForm'

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)

  const title = isSignUp ? 'Sign Up' : 'Login'
  const form = isSignUp ? <SignupForm /> : <SigninForm />
  const reference = isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        {form}
        <p
          style={{
            marginTop: '15px',
            cursor: 'pointer',
            color: '#1677ff',
            textAlign: 'right'
          }}
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {reference}
        </p>
      </div>
    </div>
  )
}
