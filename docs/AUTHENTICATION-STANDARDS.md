# CashFlow Enterprise

# AUTHENTICATION-STANDARDS.md

Version: 1.0

Status: Official Authentication Standard

---

# Purpose

This document defines the authentication and authorization standards for CashFlow Enterprise.

Every authentication feature must follow this document.

Do not deviate from these standards without architectural approval.

---

# Authentication Principles

Authentication must be:

- Secure by default
- Stateless where possible
- Enterprise-ready
- OWASP compliant
- Mobile compatible
- Web compatible
- API-first
- Scalable

---

# Technology Stack

Backend

- NestJS

Authentication

- JWT

Password Hashing

- Argon2id

Database

- PostgreSQL

ORM

- Prisma

Cache

- Redis

---

# Password Policy

Minimum Length

12 Characters

Must contain

✓ Uppercase

✓ Lowercase

✓ Number

✓ Special Character

Reject:

Common Passwords

Leaked Passwords (Future)

Dictionary Passwords

---

# Password Hashing

Algorithm

Argon2id

Never:

Store plaintext password

Store reversible password

Log password

Return password

---

# Authentication Flow

User Login

↓

Validate Credentials

↓

Generate Access Token

↓

Generate Refresh Token

↓

Store Refresh Token Hash

↓

Return Tokens

---

# Token Strategy

Use:

Access Token

Refresh Token

Never use:

Long-lived JWT only

---

# Access Token

Expiration

15 Minutes

Contains

User ID

Email

Role

Permission Version

Session ID

Issued At

Expiration

JWT ID

---

# Refresh Token

Expiration

7 Days

Rotation

Enabled

One-time Use

Yes

Store

Hash Only

---

# Refresh Token Rotation

Every refresh request must:

Invalidate old refresh token

↓

Generate new refresh token

↓

Generate new access token

↓

Update database

---

# Token Storage

Web

Access Token

Memory

Refresh Token

HttpOnly Secure Cookie

Android

Secure Storage

iOS

Keychain

Never:

LocalStorage for Refresh Token

SessionStorage for Refresh Token

---

# Logout

Logout must:

Delete Refresh Token

Invalidate Session

Blacklist Current JWT (Redis)

Clear Cookie

---

# Session Management

Every login creates:

New Session

Track:

IP Address

Browser

Device

Location (Future)

Last Activity

Login Time

Logout Time

---

# Concurrent Login

Allow:

Multiple Devices

Each device has its own session.

---

# Session Revocation

Administrator can:

Terminate one session

Terminate all sessions

Force logout

---

# JWT Claims

sub

email

role

permissionsVersion

sessionId

iat

exp

jti

---

# Authorization

Use:

RBAC

Role Based Access Control

Never hardcode permissions.

---

# Default Roles

Super Admin

Administrator

Manager

Finance

Auditor

Employee

Viewer

---

# Permission Strategy

Permissions must be granular.

Example:

users.read

users.create

users.update

users.delete

transactions.read

transactions.create

transactions.update

transactions.delete

reports.export

dashboard.view

---

# Account Lockout

After:

5 Failed Login Attempts

Lock Account

15 Minutes

Log Security Event

---

# Email Verification

Required

Before:

First Login

or

Sensitive Features

---

# Forgot Password

Generate

Secure Random Token

Expiration

15 Minutes

Single Use

---

# Reset Password

Invalidate:

All Sessions

All Refresh Tokens

JWT Blacklist

---

# Audit Logging

Log:

Login

Logout

Password Change

Password Reset

Failed Login

Account Lock

Permission Change

Role Change

Session Revocation

---

# Security Headers

Helmet

CORS

Secure Cookies

SameSite

CSRF Protection (Future)

---

# Rate Limiting

Login

5 Requests / Minute

Forgot Password

3 Requests / Hour

Verification Email

5 Requests / Hour

---

# Two Factor Authentication

Status

Future Ready

Support:

TOTP

Authenticator App

Recovery Codes

---

# API Response

Success

{
  "success": true,
  "message": "Authentication successful",
  "data": {}
}

Error

{
  "success": false,
  "errorCode": "AUTH_001",
  "message": "Invalid credentials",
  "errors": []
}

---

# Error Codes

AUTH_001

Invalid Credentials

AUTH_002

Access Token Expired

AUTH_003

Refresh Token Expired

AUTH_004

Refresh Token Invalid

AUTH_005

Account Locked

AUTH_006

Email Not Verified

AUTH_007

Permission Denied

AUTH_008

Session Expired

AUTH_009

Session Revoked

AUTH_010

Password Too Weak

---

# Mobile Compatibility

Authentication must support:

Web

Android

iOS

PWA

Desktop

---

# Enterprise Rules

Never expose:

Password

Refresh Token

JWT Secret

Private Key

Stack Trace

Internal Database Error

---

# Coding Rules

Controllers

Authentication only.

Business logic belongs inside Service.

Repositories communicate with Prisma.

Never access Prisma directly inside Controller.

---

# Testing Requirements

Authentication

100% Critical Path Coverage

Must test:

Login

Logout

Refresh

Reset Password

JWT

RBAC

Permissions

Expired Token

Invalid Token

Concurrent Sessions

---

# Definition of Done

Authentication is complete only when:

✓ JWT works

✓ Refresh Rotation works

✓ Logout works

✓ RBAC works

✓ Permission works

✓ Swagger updated

✓ Tests pass

✓ No TypeScript errors

✓ No ESLint errors

✓ Production Ready

---

# END OF AUTHENTICATION STANDARD V1.0