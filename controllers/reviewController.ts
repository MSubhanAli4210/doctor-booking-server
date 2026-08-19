import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Appointment from '../models/Appointment.js';

// Patient — leave a review for a completed appointment
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { appointmentId, rating, comment } = req.body;
    const patientId = req.userId;

    if (!appointmentId || !rating) {
      res.status(400).json({ message: 'Appointment ID and rating are required' });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ message: 'Rating must be between 1 and 5' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      res.status(400).json({ message: 'Invalid appointment ID' });
      return;
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    if (appointment.patient.toString() !== patientId) {
      res.status(403).json({ message: 'You can only review your own appointments' });
      return;
    }

    if (appointment.status !== 'completed') {
      res.status(400).json({ message: 'You can only review completed appointments' });
      return;
    }

    const existingReview = await Review.findOne({ appointment: appointmentId });
    if (existingReview) {
      res.status(409).json({ message: 'You have already reviewed this appointment' });
      return;
    }

    const review = await Review.create({
      patient: patientId,
      doctor: appointment.doctor,
      appointment: appointmentId,
      rating,
      comment,
    });

    res.status(201).json({ message: 'Review submitted', review });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit review', error: (error as Error).message });
  }
};

// Public — all reviews for a doctor
export const getDoctorReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.params.doctorId as string;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      res.status(400).json({ message: 'Invalid doctor ID' });
      return;
    }

    const reviews = await Review.find({ doctor: doctorId })
      .populate('patient', 'name')
      .sort({ createdAt: -1 });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    res.status(200).json({
      count: reviews.length,
      averageRating: Math.round(avgRating * 10) / 10,
      reviews,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch reviews', error: (error as Error).message });
  }
};

// Patient — delete their own review
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params.id as string;

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    if (review.patient.toString() !== req.userId) {
      res.status(403).json({ message: 'You can only delete your own reviews' });
      return;
    }

    await review.deleteOne();

    res.status(200).json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete review', error: (error as Error).message });
  }
};