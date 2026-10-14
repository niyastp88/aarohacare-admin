import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { APP_ROUTES } from '@/constants/routes';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from '@/features/auth';
import { AppointmentsPage } from '@/features/appointments';
import { DashboardPage } from '@/features/dashboard';
import { AddDoctorPage, DoctorDetailPage, DoctorsPage, EditDoctorPage } from '@/features/doctors';
import {
  LabReportsPage,
  LabUserDetailPage,
  LabUsersPage,
} from '@/features/lab';
import { OfflineBookingPage } from '@/features/offline-booking';
import { OpControlPage } from '@/features/queue';
import {
  CancelledPatientsPage,
  PatientDetailPage,
  PatientsPage,
  UserDirectoryPage,
} from '@/features/patients';
import {
  DoctorWalletsPage,
  DoctorWalletDetailPage,
  DoctorWalletDuesPage,
  DoctorDuesDetailPage,
  TotalBookingsPage,
  MonthCancelledBookingsPage,
  PayAarohCarePage,
  PaymentHistoryPage,
  PaymentSuccessPage,
  PaymentSummaryPage,
  AdminPaymentRetryPage,
  PlatformDuesPage,
} from '@/features/payments';
import { SchedulesPage } from '@/features/schedules';
import { SettingsPage } from '@/features/settings';
import { ChatPage } from '@/features/chat';
import { NotificationsPage } from '@/features/notifications';
import { ProtectedRoute } from './ProtectedRoute';
import { LabOnlyRoute, ClinicOnlyRoute } from './FacilityTypeRoute';

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path={APP_ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={APP_ROUTES.REGISTER} element={<RegisterPage />} />
      <Route path={APP_ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path={APP_ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path={APP_ROUTES.ADMIN.ROOT} element={<PortalLayout />}>
          <Route index element={<DashboardPage />} />

          <Route element={<LabOnlyRoute />}>
            <Route path="reports" element={<LabReportsPage />} />
            <Route path="users" element={<LabUsersPage />} />
            <Route path="users/:patientId" element={<LabUserDetailPage />} />
          </Route>

          <Route element={<ClinicOnlyRoute />}>
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/directory" element={<UserDirectoryPage />} />
            <Route path="patients/cancelled" element={<CancelledPatientsPage />} />
            <Route path="patients/:patientId" element={<PatientDetailPage />} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="doctors/new" element={<AddDoctorPage />} />
            <Route path="doctors/:doctorId/edit" element={<EditDoctorPage />} />
            <Route path="doctors/:doctorId" element={<DoctorDetailPage />} />
            <Route path="schedules" element={<SchedulesPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="offline-booking" element={<OfflineBookingPage />} />
            <Route path="op-control" element={<OpControlPage />} />
          </Route>

          <Route path="settings" element={<SettingsPage />} />
          <Route path="pay" element={<PayAarohCarePage />}>
            <Route path="summary" element={<PaymentSummaryPage />} />
            <Route path="summary/:monthKey" element={<DoctorWalletDuesPage />} />
            <Route path="summary/:monthKey/doctor/:doctorId" element={<DoctorDuesDetailPage />} />
            <Route path="summary/:monthKey/total-bookings" element={<TotalBookingsPage />} />
            <Route path="summary/:monthKey/cancelled" element={<MonthCancelledBookingsPage />} />
          </Route>
          <Route path="pay/success" element={<PaymentSuccessPage />} />
          <Route path="pay/retry/:orderId" element={<AdminPaymentRetryPage />} />
          <Route path="pay/retry" element={<AdminPaymentRetryPage />} />
          <Route path="pay/history" element={<PaymentHistoryPage />} />
          <Route path="billing/doctor-wallets" element={<DoctorWalletsPage />} />
          <Route path="billing/doctor-wallets/:doctorId" element={<DoctorWalletDetailPage />} />
          <Route path="billing/platform-dues" element={<PlatformDuesPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="payment/callback" element={<PaymentSuccessPage />} />
      </Route>

      <Route path="*" element={<Navigate to={APP_ROUTES.ADMIN.ROOT} replace />} />
    </Routes>
  </BrowserRouter>
);
