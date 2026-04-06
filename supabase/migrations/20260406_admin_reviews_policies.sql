-- Migration: Admin policies for reviews table
-- Fixes 400 error when admin fetches pending reviews with profiles join

-- Admins can see ALL reviews (including pending)
DROP POLICY IF EXISTS "Admin read all reviews" ON reviews;
CREATE POLICY "Admin read all reviews"
  ON reviews FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Admins can update review status (approve/reject)
DROP POLICY IF EXISTS "Admin update reviews" ON reviews;
CREATE POLICY "Admin update reviews"
  ON reviews FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Admins can delete reviews
DROP POLICY IF EXISTS "Admin delete reviews" ON reviews;
CREATE POLICY "Admin delete reviews"
  ON reviews FOR DELETE
  USING (public.get_my_role() = 'admin');
