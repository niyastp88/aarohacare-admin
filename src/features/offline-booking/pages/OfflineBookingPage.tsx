import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useLiveQueue, useOfflineBooking } from '@/hooks/useAppointments';
import { useDoctorSchedule, useDoctors } from '@/hooks/useDoctors';
import { toTitleCase } from '@/utils/formatters';

const todayIso = () => new Date().toISOString().slice(0, 10);

export const OfflineBookingPage = () => {
  const { data: doctors = [], isLoading } = useDoctors();
  const bookOffline = useOfflineBooking();

  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [opNumber, setOpNumber] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const scheduleQuery = useDoctorSchedule(doctorId, date);
  const schedule = scheduleQuery.data;
  const liveQueue = useLiveQueue(doctorId, date, { refetchInterval: 1000 });
  const currentOp = liveQueue.data?.liveOpNumber ?? 0;

  const takenOps = useMemo(() => {
    const list = liveQueue.data?.appointments ?? [];
    return list
      .map((appt) => Number(appt.tokenNumber))
      .filter((n) => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);
  }, [liveQueue.data?.appointments]);

  const takenSet = useMemo(() => new Set(takenOps), [takenOps]);

  useEffect(() => {
    if (!doctorId && doctors[0]) setDoctorId(doctors[0]._id);
  }, [doctorId, doctors]);

  useEffect(() => {
    setOpNumber('');
  }, [doctorId, date]);

  const parsedOp = Number(opNumber);
  const opIsValidInteger = Number.isInteger(parsedOp) && parsedOp > 0;
  const opIsUpcoming = opIsValidInteger && parsedOp > currentOp;
  const opIsFree = opIsValidInteger && !takenSet.has(parsedOp);
  const canSubmit =
    Boolean(doctorId) &&
    Boolean(schedule) &&
    !schedule?.isClosed &&
    opIsUpcoming &&
    opIsFree &&
    Boolean(patientName.trim()) &&
    Boolean(patientPhone.trim());

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!doctorId || !patientName.trim() || !patientPhone.trim()) {
      setError('Doctor, patient name, and phone are required');
      return;
    }
    if (!schedule || schedule.isClosed) {
      setError('Create an open schedule for this date before offline booking');
      return;
    }
    if (!opIsValidInteger) {
      setError('Enter a valid OP number');
      return;
    }
    if (!opIsUpcoming) {
      setError(`OP must be greater than current OP (${currentOp})`);
      return;
    }
    if (!opIsFree) {
      setError(`OP ${parsedOp} is already booked`);
      return;
    }

    bookOffline.mutate(
      {
        doctorId,
        date,
        tokenNumber: parsedOp,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientAge: patientAge ? Number(patientAge) : undefined,
      },
      {
        onSuccess: (appointment) => {
          showToast(`Offline OP created · Token ${appointment.tokenNumber}`);
          setSuccess(`Offline OP created · Token ${appointment.tokenNumber}`);
          setPatientName('');
          setPatientPhone('');
          setPatientAge('');
          setOpNumber('');
        },
        onError: (err) => {
          const message = getApiErrorMessage(err);
          setError(message);
          showToast(message, 'error');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Offline booking</h2>
        <p className="text-sm text-muted">
          Assign an upcoming OP number for a walk-in. That number is reserved so patient app
          bookings will skip it.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isLoading ? (
            <Spinner label="Loading doctors…" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold" htmlFor="offline-doctor">
                  Doctor
                </label>
                <select
                  id="offline-doctor"
                  className="rounded-xl border border-border bg-white px-3.5 py-2.5 outline-none focus:border-primary"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                >
                  {doctors.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>
                      {toTitleCase(doctor.name)}
                      {doctor.specialization ? ` · ${doctor.specialization}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <DatePickerField label="Date" value={date} onChange={setDate} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Patient name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Patient full name"
            />
            <Input
              label="Phone"
              inputMode="tel"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              placeholder="9876543210"
            />
            <Input
              label="Age (optional)"
              inputMode="numeric"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          {scheduleQuery.isLoading ? (
            <Spinner label="Loading OP status…" />
          ) : !schedule ? (
            <div className="rounded-xl border border-dashed border-border bg-primary-light/30 px-4 py-5 text-sm text-muted">
              No schedule for this date.{' '}
              <Link to={APP_ROUTES.ADMIN.SCHEDULES} className="font-semibold text-primary">
                Create a schedule
              </Link>{' '}
              first, then book offline here.
            </div>
          ) : schedule.isClosed ? (
            <div className="rounded-xl border border-waiting bg-waiting-soft px-4 py-3 text-sm text-waiting">
              This day is marked closed for the selected doctor.
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-primary-light/20 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                    </span>
                    <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                      Current OP · Live
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {liveQueue.isLoading && liveQueue.data == null ? '…' : currentOp || '—'}
                  </p>
                </div>
                <p className="text-sm text-muted">
                  Enter an upcoming OP number greater than{' '}
                  <span className="font-semibold text-primary-dark">{currentOp}</span>. Patient
                  bookings will automatically skip reserved numbers.
                </p>
              </div>

              <Input
                label="Upcoming OP number"
                inputMode="numeric"
                value={opNumber}
                onChange={(e) => setOpNumber(e.target.value.replace(/\D/g, ''))}
                placeholder={`e.g. ${currentOp + 1}`}
              />

              {opNumber && !opIsValidInteger && (
                <p className="text-sm text-error">Enter a valid OP number</p>
              )}
              {opIsValidInteger && !opIsUpcoming && (
                <p className="text-sm text-error">
                  OP {parsedOp} is not upcoming — must be greater than current OP ({currentOp})
                </p>
              )}
              {opIsUpcoming && !opIsFree && (
                <p className="text-sm text-error">OP {parsedOp} is already booked</p>
              )}

              {takenOps.length > 0 && (
                <div>
                  <p className="mb-1.5 text-sm font-semibold">Already booked OPs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {takenOps.map((n) => (
                      <span
                        key={n}
                        className="rounded-lg border border-error/25 bg-error-soft px-2 py-1 text-xs font-bold text-error"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}

          <div>
            <Button type="submit" loading={bookOffline.isPending} disabled={!canSubmit}>
              Create offline OP
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
