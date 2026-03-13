-- Add email column to public.users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS email TEXT;
