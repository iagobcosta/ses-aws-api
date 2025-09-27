require("dotenv").config()
const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const { body, validationResult } = require("express-validator")
const AWS = require("aws-sdk")
const compression = require("compression")
const winston = require("winston")

const app = express()
const PORT = process.env.PORT || 3001

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    // Adicione outros transports se necessário (ex: arquivo)
  ],
})

// AWS SES Configuration
const ses = new AWS.SES({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

// Middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
)
app.use(express.json({ limit: "10mb" }))
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS), // Definido apenas por env
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS), // Definido apenas por env
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: Math.ceil(
      parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use("/api/contact", limiter)

// Email template
const createEmailHTML = (data) => {
  const serviceLabels = {
    web: "Desenvolvimento Web",
    mobile: "Aplicativo Mobile",
    api: "Integração de APIs",
    support: "Suporte e Manutenção",
    consulting: "Consultoria",
    other: "Outro",
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Novo Contato - Darcaltech</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px; }
        .field { margin-bottom: 15px; }
        .field strong { color: #374151; display: block; margin-bottom: 5px; }
        .field span { color: #6b7280; }
        .message-box { 
          background: white; 
          border-left: 4px solid #1e40af; 
          padding: 15px; 
          margin-top: 10px; 
          border-radius: 0 5px 5px 0;
        }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 14px; }
        .footer p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Novo Contato - Darcaltech</h1>
        </div>
        
        <div class="content">
          <h2 style="color: #1f2937; margin-bottom: 20px;">Detalhes do Contato</h2>
          
          <div class="field">
            <strong>Nome:</strong>
            <span>${data.name}</span>
          </div>
          
          <div class="field">
            <strong>Email:</strong>
            <span>${data.email}</span>
          </div>
          
          <div class="field">
            <strong>Telefone:</strong>
            <span>${data.phone}</span>
          </div>
          
          ${
            data.company
              ? `
          <div class="field">
            <strong>Empresa:</strong>
            <span>${data.company}</span>
          </div>
          `
              : ""
          }
          
          <div class="field">
            <strong>Serviço de Interesse:</strong>
            <span>${serviceLabels[data.service] || data.service}</span>
          </div>
          
          <div class="field">
            <strong>Mensagem:</strong>
            <div class="message-box">
              ${data.message.replace(/\n/g, "<br>")}
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>Este email foi enviado através do formulário de contato do site da Darcaltech.</p>
          <p>Data: ${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Validation middleware
const validateContactForm = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Nome deve ter entre 2 e 100 caracteres"),
  body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
  body("phone")
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage("Telefone deve ter entre 10 e 20 caracteres"),
  body("company")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Nome da empresa deve ter no máximo 100 caracteres"),
  body("service")
    .isIn(["web", "mobile", "api", "support", "consulting", "other"])
    .withMessage("Serviço inválido"),
  body("message")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Mensagem deve ter entre 10 e 2000 caracteres"),
]

// Contact form endpoint
app.post("/api/contact", validateContactForm, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      logger.warn("Validation error on contact form", { errors: errors.array() })
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      })
    }

    const { name, email, phone, company, service, message } = req.body

    // Prepare email parameters
    const emailParams = {
      Source: process.env.FROM_EMAIL,
      Destination: {
        ToAddresses: [process.env.TO_EMAIL],
      },
      ReplyToAddresses: [email],
      Message: {
        Subject: {
          Data: `Novo contato via site - ${name}`,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: createEmailHTML({
              name,
              email,
              phone,
              company,
              service,
              message,
            }),
            Charset: "UTF-8",
          },
          Text: {
            Data: `
Novo contato via site da Darcaltech

Nome: ${name}
Email: ${email}
Telefone: ${phone}
${company ? `Empresa: ${company}` : ""}
Serviço: ${service}
Mensagem: ${message}

Data: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            `,
            Charset: "UTF-8",
          },
        },
      },
    }

    // Send email via AWS SES
    const result = await ses.sendEmail(emailParams).promise()

    logger.info("Email sent successfully", { messageId: result.MessageId, to: process.env.TO_EMAIL, from: process.env.FROM_EMAIL })

    res.json({
      success: true,
      message: "Mensagem enviada com sucesso! Entraremos em contato em breve.",
      messageId: result.MessageId,
    })
  } catch (error) {
    logger.error("Error sending email", { error: error.message, stack: error.stack })

    res.status(500).json({
      success: false,
      message:
        "Erro ao enviar mensagem. Tente novamente ou entre em contato diretamente.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    })
  }
})

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack })
  res.status(500).json({
    success: false,
    message: "Algo deu errado!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint não encontrado",
  })
})

app.listen(PORT, () => {
  logger.info("Server started", {
    port: PORT,
    fromEmail: process.env.FROM_EMAIL,
    toEmail: process.env.TO_EMAIL,
    environment: process.env.NODE_ENV || "development",
  })
})
