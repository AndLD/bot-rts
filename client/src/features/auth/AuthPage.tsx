'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AuthFrame from './AuthFrame'
import SigninForm from './SigninForm'
import SignupForm from './SignupForm'

export default function AuthPage() {
  const t = useTranslations('auth')
  const [isSignUp, setIsSignUp] = useState(false)

  const title = isSignUp ? t('signup.title') : t('login.title')
  const form = isSignUp ? <SignupForm /> : <SigninForm />
  const reference = isSignUp ? t('signup.toLogin') : t('login.toSignup')

  return (
    <AuthFrame>
      <h1>{title}</h1>
      {form}
      <button type="button" className="auth-switch" onClick={() => setIsSignUp(!isSignUp)}>
        {reference}
      </button>
    </AuthFrame>
  )
}
