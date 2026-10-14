import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAppointments } from '@/hooks/useAppointments';
import { useDoctors } from '@/hooks/useDoctors';
import type { DoctorResponseDto, UserResponseDto } from '@/types/dto';
import { toTitleCase } from '@/utils/formatters';
import { format12Hour } from '@/utils/dateTime';
import {
  OpConsultationPrintForm,
  type OpConsultationFormData,
} from '@/components/print/OpConsultationPrintForm';

/** `null` = pick a doctor; `'all'` = every booking; otherwise one doctor. */
type Selection = null | 'all' | string;

const personName = (value: string | UserResponseDto | DoctorResponseDto | undefined) => {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return toTitleCase(value.name);
};

const appointmentPatientName = (appt: any) => {
  if (appt.patientName) return toTitleCase(appt.patientName);
  return personName(appt.patientId);
};

const doctorSpec = (value: string | DoctorResponseDto | undefined) => {
  if (!value || typeof value === 'string') return null;
  return value.specialization || null;
};

const DoctorAvatar = ({ doctor }: { doctor?: DoctorResponseDto | null }) => {
  if (doctor?.profileImage) {
    return (
      <img
        src={doctor.profileImage}
        alt=""
        className="h-14 w-14 rounded-2xl object-cover"
      />
    );
  }
  const initial = toTitleCase(doctor?.name || 'D').charAt(0);
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-xl font-black text-primary-dark">
      {initial}
    </div>
  );
};

export const AppointmentsPage = () => {
  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors();
  const [selection, setSelection] = useState<Selection>(null);
  const [printData, setPrintData] = useState<OpConsultationFormData | null>(null);

  const handlePrintAppointment = (appointment: any) => {
    const doctor = typeof appointment.doctorId === 'object' ? appointment.doctorId : null;
    const patientObj = typeof appointment.patientId === 'object' ? appointment.patientId : null;
    setPrintData({
      doctorName: doctor?.name || (typeof appointment.doctorId === 'string' ? appointment.doctorId : ''),
      department: doctor?.specialization || 'General Medicine',
      date: appointment.date,
      patientName: appointmentPatientName(appointment),
      tokenNumber: appointment.tokenNumber,
      opNumber: appointment.tokenNumber ? `OP-${String(appointment.tokenNumber).padStart(6, '0')}` : undefined,
      age: appointment.patientAge ?? patientObj?.age,
      gender: appointment.patientGender || patientObj?.gender,
      phone: appointment.patientPhone || patientObj?.phone,
      place: appointment.place || patientObj?.place || patientObj?.address,
    });
  };

  const doctorFilter = selection && selection !== 'all' ? selection : undefined;
  const appointmentsEnabled = selection !== null;
  const {
    data: appointments = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAppointments(doctorFilter, appointmentsEnabled);

  const selectedDoctor = useMemo(
    () => (selection && selection !== 'all' ? doctors.find((d) => d._id === selection) : null),
    [doctors, selection],
  );

  const heading =
    selection === 'all'
      ? 'All bookings'
      : selectedDoctor
        ? toTitleCase(selectedDoctor.name)
        : 'Booked patients';

  if (selection === null) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">Booked patients</h2>
          <p className="text-sm text-muted">Choose a doctor to see their bookings, or view all.</p>
        </div>

        {doctorsLoading && <Spinner label="Loading doctors…" />}

        {!doctorsLoading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            <button
              type="button"
              onClick={() => setSelection('all')}
              className="rounded-2xl border-2 border-primary bg-primary-light p-4 text-left transition hover:border-primary-dark hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white">
                All
              </div>
              <p className="mt-3 text-base font-bold text-primary-dark">All bookings</p>
              <p className="text-sm text-muted">Every appointment across doctors</p>
            </button>

            {doctors.map((doctor) => (
              <button
                key={doctor._id}
                type="button"
                onClick={() => setSelection(doctor._id)}
                className="rounded-2xl border border-border bg-white p-4 text-left transition hover:border-primary hover:shadow-md"
              >
                <DoctorAvatar doctor={doctor} />
                <p className="mt-3 text-base font-bold">{toTitleCase(doctor.name)}</p>
                <p className="text-sm text-muted">{doctor.specialization || 'General OP'}</p>
              </button>
            ))}
          </div>
        )}

        {!doctorsLoading && doctors.length === 0 && (
          <Card>
            <p className="text-muted">Add doctors first, then their bookings will appear here.</p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackButton onClick={() => setSelection(null)}>Back to doctors</BackButton>
          <h2 className="mt-3 text-xl font-bold">{heading}</h2>
          <p className="text-sm text-muted">
            {selection === 'all'
              ? 'All facility bookings'
              : selectedDoctor?.specialization || 'Doctor bookings'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          Refresh
        </Button>
      </div>

      {isLoading && <Spinner label="Loading appointments…" />}

      {!isLoading && isError && (
        <Card>
          <p className="text-error">{getApiErrorMessage(error)}</p>
        </Card>
      )}

      {!isLoading && !isError && appointments.length === 0 && (
        <Card>
          <p className="text-muted">No bookings yet for this selection.</p>
        </Card>
      )}

      {!isLoading && !isError && appointments.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-muted">
                    Patient
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-muted">
                    Doctor
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-muted">
                    Date / Time
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-muted">
                    Token
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-muted">
                    Fee
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => {
                  const spec = doctorSpec(appointment.doctorId);
                  return (
                    <tr key={appointment._id} className="border-b border-border last:border-b-0">
                      {/* Patient column: Name with printer icon on the right side */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-between gap-2.5">
                          <span className="font-semibold text-[#0F172A]">{appointmentPatientName(appointment)}</span>
                          <button
                            type="button"
                            title="Print OP Consultation Form"
                            aria-label="Print OP Consultation Form"
                            onClick={() => handlePrintAppointment(appointment)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1E4287] bg-white text-[#1E4287] shadow-2xs transition hover:bg-blue-50/70 active:scale-95"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 6 2 18 2 18 9" />
                              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                              <rect x="6" y="14" width="12" height="8" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{personName(appointment.doctorId)}</div>
                        {spec && <div className="text-[13px] text-muted">{spec}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {appointment.date} · {appointment.time ? (appointment.time === 'QUEUE' ? 'Queue' : format12Hour(appointment.time)) : '—'}
                      </td>
                      <td className="px-3 py-3">{appointment.tokenNumber ?? '—'}</td>
                      <td className="px-3 py-3">
                        {appointment.consultationFee != null
                          ? `₹${appointment.consultationFee}`
                          : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={appointment.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Render dedicated A4 OP Consultation Form print overlay when selected */}
      {printData && (
        <OpConsultationPrintForm
          data={printData}
          onClose={() => setPrintData(null)}
        />
      )}
    </div>
  );
};
