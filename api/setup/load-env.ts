import dotenv from 'dotenv'

// Must run before any module that reads process.env at load time
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` })
