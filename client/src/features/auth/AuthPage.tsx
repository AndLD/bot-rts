'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher'
import './AuthPage.scss'
import SigninForm from './SigninForm'
import SignupForm from './SignupForm'

export default function AuthPage() {
  const t = useTranslations('auth')
  const [isSignUp, setIsSignUp] = useState(false)

  const title = isSignUp ? t('signup.title') : t('login.title')
  const form = isSignUp ? <SignupForm /> : <SigninForm />
  const reference = isSignUp ? t('signup.toLogin') : t('login.toSignup')

  return (
    <div className="auth-page">
      <div className="auth-language">
        <LanguageSwitcher />
      </div>
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
