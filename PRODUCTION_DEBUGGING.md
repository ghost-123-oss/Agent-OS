# Production Debugging Guide

## Issue: "Initializing Processor..." Stuck in Production

If you encounter the "Initializing Processor..." message that doesn't progress in production, follow these steps:

### 1. Check Browser Console Logs

Open browser DevTools (F12) and check the Console tab for error messages. Look for:
- `[useWorkspace] Chat failed after Xms:` - indicates API call failure
- `Chat service failed` - indicates service layer error
- `Orchestrator: Error during chat processing` - indicates backend error
- `Chat route unhandled error` - indicates API route error

### 2. Verify Environment Variables

Check that all required API keys are configured in your production environment:

```bash
# Required environment variables
MISTRAL_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
GROQ_API_KEY_2=your_key_here
MISTRAL_API_KEY_2=your_key_here

# Optional (for forcing mock mode)
NEXT_PUBLIC_FORCE_MOCK_MODE=false  # or true for testing
```

**For Vercel:**
```bash
vercel env ls  # List all environment variables
vercel env pull  # Pull environment variables locally
```

**For other platforms:** Check your platform's environment variable settings.

### 3. Check if Mock Mode is Active

The system will use mock responses if:
- `MISTRAL_API_KEY` is not set
- `FORCE_MOCK_MODE` or `NEXT_PUBLIC_FORCE_MOCK_MODE` is set to "true"

Check the logs for:
```
[LLM] Mock mode active — all agents use MockProvider
```

### 4. Test API Endpoint

Test the `/api/chat` endpoint directly:

```bash
curl -X POST https://your-domain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

Expected response:
```json
{
  "content": "Thanks for sharing that! A few follow-up questions:..."
}
```

If you get an error, check:
- API keys are set
- API route is deployed
- No CORS issues

### 5. Check Server Logs

**For Vercel:**
```bash
vercel logs
```

**For other platforms:** Check your platform's logging dashboard.

Look for:
- `Chat route called` - API route was hit
- `Orchestrator: Starting chat processing` - orchestrator started
- `Orchestrator: Provider obtained` - LLM provider created
- `Orchestrator: Response received successfully` - success!
- `ERROR` or `Chat route unhandled error` - something failed

### 6. Common Issues and Fixes

#### Issue: API Keys Not Configured
**Symptoms:** Logs show "Mock mode active" or provider initialization fails
**Fix:** Add API keys to your production environment variables

#### Issue: Network Timeout
**Symptoms:** "Request timed out" error after 30 seconds
**Fix:** 
- Check network connectivity
- Increase timeout in `chat.service.ts` (currently 30s)
- Check if LLM provider is accessible from your region

#### Issue: Circuit Breaker Tripped
**Symptoms:** Immediate failure without attempting API call
**Fix:** 
- Wait 60 seconds for circuit breaker to allow probe request
- Check logs for "Circuit breaker OPEN" messages
- Restart the application to reset in-memory circuit breaker

#### Issue: API Route Not Deployed
**Symptoms:** 404 error when calling `/api/chat`
**Fix:** 
- Ensure Next.js API routes are deployed
- Check your deployment configuration
- Verify the route exists in your codebase

#### Issue: CORS or Origin Issues
**Symptoms:** Request blocked by browser
**Fix:** 
- Check `next.config.ts` for `allowedDevOrigins` (dev only)
- Ensure production domain is properly configured
- Check browser console for CORS errors

### 7. Enable Verbose Logging

To get more detailed logs, add this to your code temporarily:

```typescript
// In lib/logger.ts, add more detailed logging
console.log("DEBUG:", { /* diagnostic info */ });
```

### 8. Test with Mock Mode

To verify the UI works even if API keys are missing:

```bash
# Set in production environment
NEXT_PUBLIC_FORCE_MOCK_MODE=true
```

This will use simulated responses without calling external APIs.

### 9. Check Deployment Configuration

Ensure your deployment platform:
- Has all environment variables configured
- Allows outbound requests to LLM APIs (Mistral, Gemini, Groq)
- Has proper network configuration (no firewall blocking)
- Is using the correct Node.js version (18+)

### 10. Diagnostic Checklist

- [ ] Browser console shows no errors
- [ ] API keys are configured in production
- [ ] `/api/chat` endpoint returns a response
- [ ] Server logs show "Chat route called"
- [ ] Server logs show "Orchestrator: Response received successfully"
- [ ] No circuit breaker errors in logs
- [ ] No timeout errors in logs
- [ ] Network tab shows successful POST to `/api/chat`

## Quick Fix Commands

### Reset Circuit Breaker (if tripped)
The circuit breaker is in-memory and resets on application restart:
```bash
# Vercel
vercel --prod

# Other platforms
# Restart your application
```

### Test Environment Variables
Add this temporarily to your API route to verify env vars:
```typescript
// In app/api/chat/route.ts, add after line 11:
logger.info("Environment check", {
  hasMistralKey: !!process.env.MISTRAL_API_KEY,
  hasGeminiKey: !!process.env.GEMINI_API_KEY,
  hasGroqKey: !!process.env.GROQ_API_KEY,
  isMockMode: isMockMode(),
}, traceId);
```

## Getting Help

If the issue persists:
1. Collect all console logs from browser
2. Collect server logs from your hosting platform
3. Verify environment variables are set
4. Test the `/api/chat` endpoint with curl
5. Check if the issue happens in mock mode (`NEXT_PUBLIC_FORCE_MOCK_MODE=true`)
