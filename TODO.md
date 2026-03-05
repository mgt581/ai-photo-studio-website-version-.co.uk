# Subscription Tracking System Implementation Plan

## Information Gathered:
- **Payment Links** (index.html):
  - Day Pass (£1): `https://buy.stripe.com/fZubJ30ki5EbdJNfj8d3i0a`
  - Monthly (£4.99): `https://buy.stripe.com/cNi8wRaYW9UraxB2wmd3i09`
  - Yearly Pro: `https://buy.stripe.com/4gM00l8QOfeL7lp9YOd3i08`

- **Current Flow**: When payment succeeds, URL returns `?paid=true` or `?payment=success`, then `activatePro(type)` is called

- **Existing Trial System**: Already has `trial.endsAt` field in Firestore and trial display logic

- **Display Locations**:
  - Header (index.html): `#trialLeft` element shows subscription status
  - Settings (settings.html): `#uPlanBadge` and `#uTrial` elements

## Plan:

### 1. Update Firestore User Data Structure
Add these fields to track subscriptions:
- `subscription.type`: 'trial' | 'daypass' | 'monthly' | 'yearly'
- `subscription.startedAt`: Timestamp when subscription started
- `subscription.expiresAt`: Timestamp when subscription expires

### 2. Update index.html
- Modify `activatePro()` to accept subscription type and calculate expiry
- Update `refreshUserPlan()` to display proper subscription status:
  - "7 Day Trial - X days left" for trial
  - "Day Pass - Valid until [date]" for day pass
  - "Monthly Pro - Valid until [date]" for monthly
  - "Yearly Pro - Valid until [date]" for yearly
- Update header display (`#trialLeft`) with subscription info

### 3. Update settings.html  
- Update subscription display to show correct plan type and expiry
- Show different badges for each plan type

### 4. Stripe Success URL Handling
- The current redirect URLs should pass the plan type
- Update activation logic to handle different plan types properly

## Files to Edit:
1. `index.html` - Main payment handling and subscription display
2. `settings.html` - Settings page subscription display

## Follow-up Steps:
1. Test the payment flow
2. Verify Firestore data is saved correctly
3. Test UI displays correct information for each plan type

