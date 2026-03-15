# VoiceAuth

VoiceAuth is a biometric authentication web application built with React, Vite, TypeScript, and Supabase. It combines client-side voice feature extraction with spoken passphrase verification to provide a passwordless-style sign-in experience, with email OTP fallback when voice verification fails.

This repository includes:

- a React frontend for enrollment and verification
- client-side audio processing for speaker matching
- Supabase schema and RLS policies
- Supabase edge-function code for custom OTP workflows

## Table of Contents

- [Demo Video](#demo-video)
- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [How Authentication Works](#how-authentication-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Available Scripts](#available-scripts)
- [Security Notes](#security-notes)
- [Current Limitations](#current-limitations)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)

## Demo Video

GitHub does not play repository-hosted `.mp4` files inline in `README.md`, so open the full demo from the link below.

[Watch the full demo video](./voiceauthdemo.mp4)

## Overview

Traditional password systems create usability and security tradeoffs. VoiceAuth explores an alternative authentication flow where a user's voice profile and a remembered spoken phrase are used together as a second-generation identity check.

The current application supports:

- account creation and sign-in with Supabase Auth
- voice enrollment using three recorded samples
- speaker verification using audio feature similarity
- spoken phrase comparison using browser speech recognition
- email OTP fallback after repeated failed voice checks
- audit-style logging of authentication events

## Core Capabilities

- Voice enrollment with multiple samples to create a stable voice profile
- Client-side speaker matching using MFCC-derived features and related spectral metrics
- Passphrase normalization and similarity scoring
- Strict verification thresholds for high-friction demo security
- Email OTP fallback for recovery and continuity
- Supabase-backed persistence for profile, voice metadata, and auth logs

## How Authentication Works

### 1. User Registration

Users create an account with:

- email
- password
- full name
- optional phone number

Supabase Auth manages the base identity, and a database trigger creates the associated profile record.

### 2. Voice Enrollment

To enroll, the user records three voice samples. For each sample, the app:

1. captures microphone audio in the browser
2. extracts speaker features from the waveform
3. transcribes the spoken phrase using the Web Speech API
4. normalizes the recognized text
5. stores the averaged voice profile and passphrase after all samples are complete

Enrollment only succeeds when the recorded phrases are sufficiently similar across samples.

### 3. Voice Verification

During verification, the app:

1. records a new sample
2. extracts a fresh speaker profile
3. compares the new profile with the enrolled profile
4. transcribes the spoken phrase
5. compares the spoken phrase with the stored phrase
6. grants access only if both checks pass

Current thresholds in the codebase:

- speaker match threshold: `0.95`
- phrase similarity threshold: `0.70`
- max failed attempts before OTP fallback: `3`

### 4. OTP Fallback

If voice verification fails repeatedly, the user can switch to email OTP verification. The current frontend uses Supabase's email OTP flow directly. The repository also contains edge-function code for custom OTP generation and verification workflows if you want to extend the project.

## Architecture

```text
Browser UI
  -> React + Vite frontend
  -> Microphone capture via MediaDevices API
  -> Speech recognition via Web Speech API
  -> Client-side speaker feature extraction

Frontend
  -> Supabase Auth for email/password and email OTP
  -> Supabase Postgres for profiles, voice profiles, auth logs, otp codes

Supabase
  -> Row Level Security policies
  -> Signup trigger for profile creation
  -> Optional edge functions for custom OTP delivery/verification
```

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui
- Lucide icons

### Backend and Data

- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Supabase Edge Functions

### Audio and Verification

- Web Audio APIs
- MediaRecorder
- Web Speech API
- MFCC-based feature extraction

## Repository Structure

```text
src/
  components/         reusable UI and feature components
  hooks/              auth and voice recording hooks
  lib/audio/          MFCC, speaker recognition, speech normalization
  pages/              landing, auth, dashboard views
  integrations/       Supabase client and generated types

supabase/
  migrations/         schema, RLS policies, triggers
  functions/          custom OTP-related edge functions
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- a Supabase project
- a modern Chromium-based browser for the best speech-recognition compatibility

### 1. Clone the Repository

```sh
git clone https://github.com/Mohini117/Voice-Biometric-Auth-AI.git
cd Voice-Biometric-Auth-AI
```

### 2. Install Dependencies

```sh
npm install
```

### 3. Create the Environment File

```sh
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 4. Configure Environment Variables

Fill in `.env` with values from your Supabase project.

### 5. Run the App

```sh
npm run dev
```

The app will start locally through Vite's development server.

## Environment Variables

The frontend currently expects the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_anon_key
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
```

### Optional Supabase Edge Function Secrets

If you plan to use the custom OTP edge functions in `supabase/functions`, you will also need server-side Supabase secrets such as:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_TLS`
- `SMTP_FROM`

These are not frontend variables and should be configured in Supabase secrets, not in the browser `.env`.

## Supabase Setup

### Database

The repository includes a migration that creates:

- `profiles`
- `voice_profiles`
- `auth_logs`
- `otp_codes`

It also configures:

- row-level security policies
- timestamp update triggers
- an auth trigger that inserts a `profiles` row for each new user

Apply the SQL in `supabase/migrations` using either:

- the Supabase CLI
- the SQL editor in the Supabase dashboard

### Authentication

Make sure your Supabase project has:

- email/password authentication enabled
- email OTP or magic-link style email auth configured if you want the fallback flow
- a valid site URL and redirect URL for your frontend

### Optional Edge Functions

This repository includes:

- `supabase/functions/send-otp`
- `supabase/functions/verify-otp`
- `supabase/functions/resend-email`

These are useful if you want to move to a custom OTP delivery and verification flow. The current frontend OTP component is wired to Supabase Auth's built-in email OTP methods.

## Available Scripts

- `npm run dev` starts the local Vite development server
- `npm run build` builds the app for production
- `npm run build:dev` builds the app in development mode
- `npm run lint` runs ESLint
- `npm run preview` serves the production build locally

## Security Notes

- Voice matching is performed client-side in the current implementation.
- Enrolled speaker profiles are serialized and stored in the database.
- Verification requires both biometric similarity and passphrase similarity.
- Authentication attempts are logged in `auth_logs`.
- Row Level Security is enabled for the main application tables.

This project should be treated as a strong prototype or portfolio build, not a production-grade biometric security system without further hardening, calibration, anti-spoofing, and formal security review.

## Current Limitations

- Browser speech recognition support varies by browser and operating system.
- The current UX works best in Chromium-based browsers.
- Voice verification quality depends heavily on microphone quality and background noise.
- There is no anti-spoofing or liveness detection yet.
- Thresholds are hard-coded and may need calibration for real-world use.
- The landing page mentions SMS OTP, but the current implemented fallback is email OTP.
- There is no automated test suite in this repository yet.

 
