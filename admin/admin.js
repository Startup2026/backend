const session = require('express-session')
const Application = require('../models/application.model')
const Incubator = require('../models/incubator.model')
const IncubationCode = require('../models/incubationCode.model')
const Interview = require('../models/interview.model')
const Job = require('../models/job.model')
const Notification = require('../models/notification.model')
const Payment = require('../models/payment.model')
const PendingUser = require('../models/pendingUser.model')
const Polls = require('../models/polls.model')
const Post = require('../models/post.model')
const PostAnalytics = require('../models/postAnalytics.model')
const PostLike = require('../models/postLike.model')
const PostSave = require('../models/postSave.model')
const PostView = require('../models/postView.model')
const RevenueTransaction = require('../models/revenueTransaction.model')
const SaveJob = require('../models/saveJob.model')
const SavePost = require('../models/savePost.model')
const Selection = require('../models/selection.model')
const StartupProfile = require('../models/startupprofile.model')
const StartupVerification = require('../models/startupVerification.model')
const StudentProfile = require('../models/studentprofile.model')
const User = require('../models/user.model')

const resources = [
  Application,
  Incubator,
  IncubationCode,
  Interview,
  Job,
  Notification,
  Payment,
  PendingUser,
  Polls,
  Post,
  PostAnalytics,
  PostLike,
  PostSave,
  PostView,
  RevenueTransaction,
  SaveJob,
  SavePost,
  Selection,
  StartupProfile,
  StartupVerification,
  StudentProfile,
  User,
]

let cachedAdminConfig = null

function getAdminCredentials() {
  const adminEmail = process.env.ADMINJS_EMAIL || 'admin@wostup.local'
  const adminPassword = process.env.ADMINJS_PASSWORD || 'admin123'
  const cookiePassword = process.env.ADMINJS_COOKIE_SECRET || 'supersecret-and-long-admin-cookie-key'

  return {
    adminEmail,
    adminPassword,
    cookiePassword,
  }
}

async function getAdminConfig() {
  if (cachedAdminConfig) {
    return cachedAdminConfig
  }

  const [{ default: AdminJSExpress }, AdminJSMongoose, AdminJSImport] = await Promise.all([
    import('@adminjs/express'),
    import('@adminjs/mongoose'),
    import('adminjs'),
  ])
  const AdminJS = AdminJSImport.default || AdminJSImport

  const { adminEmail, adminPassword, cookiePassword } = getAdminCredentials()

  AdminJS.registerAdapter({
    Database: AdminJSMongoose.Database,
    Resource: AdminJSMongoose.Resource,
  })

  const admin = new AdminJS({
    resources: [
      ...resources,
    ],
    rootPath: '/admin',
  })

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email, password) => {
        if (email === adminEmail && password === adminPassword) {
          return { email: adminEmail }
        }

        return null
      },
      cookieName: 'adminjs',
      cookiePassword,
    },
    null,
    {
      secret: cookiePassword,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
      name: 'adminjs.sid',
      store: new session.MemoryStore(),
    }
  )

  cachedAdminConfig = {
    admin,
    adminRouter,
    adminRootPath: admin.options.rootPath,
  }

  return cachedAdminConfig
}

module.exports = {
  getAdminConfig,
}