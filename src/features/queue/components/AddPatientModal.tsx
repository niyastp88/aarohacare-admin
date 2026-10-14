import { useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DoctorSelect } from '@/components/ui/DoctorSelect';
import { MonthCalendar, buildMonthCells } from '@/components/ui/MonthCalendar';
import { showToast } from '@/components/ui/Toast';
import { useLiveQueue, useOfflineBooking, usePatientLookup } from '@/hooks/useAppointments';
import { useDoctorSchedules, useDoctors } from '@/hooks/useDoctors';

interface AddPatientModalProps {
  open: boolean;
  defaultDoctorId?: string;
  defaultDate?: string;
  onClose: () => void;
  onBooked?: () => void;
}

export const AddPatientModal = ({
  open,
  defaultDoctorId = '',
  defaultDate,
  onClose,
  onBooked,
}: AddPatientModalProps) => {
  const today = defaultDate || new Date().toISOString().slice(0, 10);
  const todayParts = today.split('-').map(Number);
  const initialYear = todayParts[0] || new Date().getFullYear();
  const initialMonth = (todayParts[1] || 1) - 1;

  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors();
  const bookOffline = useOfflineBooking();

  const [doctorId, setDoctorId] = useState(defaultDoctorId);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const [error, setError] = useState('');

  const schedulesQuery = useDoctorSchedules(doctorId);
  const liveQueue = useLiveQueue(doctorId, selectedDate, {
    refetchInterval: open ? 3000 : false,
  });

  // Search previous OP bookings by phone so admins can quickly reuse the actual patient's name and age for offline booking.
  const patientLookupQuery = usePatientLookup(patientPhone, open && !dismissedSuggestions);

  useEffect(() => {
    if (!open) return;
    setDoctorId(defaultDoctorId || doctors[0]?._id || '');
    setSelectedDate(today);
    setViewYear(initialYear);
    setViewMonth(initialMonth);
    setPatientName('');
    setPatientAge('');
    setPatientPhone('');
    setDismissedSuggestions(false);
    setError('');
  }, [open, defaultDoctorId, doctors, today, initialYear, initialMonth]);

  const openDates = useMemo(() => {
    const set = new Set<string>();
    for (const schedule of schedulesQuery.data ?? []) {
      if (!schedule.isClosed && schedule.date) set.add(schedule.date);
    }
    return set;
  }, [schedulesQuery.data]);

  const takenSet = useMemo(() => {
    const list = liveQueue.data?.appointments ?? [];
    return new Set(
      list
        .map((appt) => Number(appt.tokenNumber))
        .filter((n) => Number.isInteger(n) && n > 0),
    );
  }, [liveQueue.data?.appointments]);

  const currentOp = liveQueue.data?.liveOpNumber ?? 0;
  const nextToken = useMemo(() => {
    let n = Math.max(1, currentOp + 1);
    while (takenSet.has(n)) n += 1;
    return n;
  }, [currentOp, takenSet]);

  const calendarCells = useMemo(
    () =>
      buildMonthCells({
        year: viewYear,
        monthIndex: viewMonth,
        mapDay: (iso, _day, inMonth) => {
          if (!inMonth) return { disabled: true };
          const hasSchedule = openDates.has(iso);
          const selected = iso === selectedDate;
          return {
            selected,
            soft: hasSchedule && !selected,
            disabled: !hasSchedule,
            title: hasSchedule ? 'Select date' : 'No open schedule',
            onClick: hasSchedule ? () => setSelectedDate(iso) : undefined,
          };
        },
      }),
    [viewYear, viewMonth, openDates, selectedDate],
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  if (!open) return null;

  const scheduleOk = openDates.has(selectedDate);
  const canSubmit =
    Boolean(doctorId) &&
    scheduleOk &&
    Boolean(patientName.trim()) &&
    /^\d{10}$/.test(patientPhone) &&
    !bookOffline.isPending;

  const handleConfirm = () => {
    setError('');
    if (!doctorId) {
      setError('Please choose a doctor');
      return;
    }
    if (!scheduleOk) {
      setError('Selected date has no open schedule for this doctor');
      return;
    }
    if (!patientName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!/^\d{10}$/.test(patientPhone)) {
      setError('Enter a valid 10-digit contact number');
      return;
    }

    bookOffline.mutate(
      {
        doctorId,
        date: selectedDate,
        tokenNumber: nextToken,
        patientName: patientName.trim(),
        patientPhone,
        patientAge: patientAge ? Number(patientAge) : undefined,
      },
      {
        onSuccess: () => {
          showToast('Patient added to queue');
          onBooked?.();
          onClose();
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#061526]/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[min(100dvh,920px)] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl border border-[#E5EAF0] bg-white shadow-2xl sm:max-h-[min(92dvh,840px)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#EEF2F6] px-5 py-3.5 sm:px-6 sm:py-4">
          <h2 className="text-[18px] font-bold text-[#0B2A4A] sm:text-[20px]">New Offline Booking</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#9AA3B2] transition hover:bg-[#F3F5F8] hover:text-[#4B5563]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
          <DoctorSelect
            label="Select Healthcare Provider"
            value={doctorId}
            options={doctors.map((doctor) => ({
              id: doctor._id,
              name: doctor.name,
              specialization: doctor.specialization,
              image: doctor.profileImage,
            }))}
            onChange={setDoctorId}
            placeholder="Choose a doctor…"
            emptyLabel="No doctors available"
            disabled={doctorsLoading}
            tone="soft"
          />

          <div className="mt-5">
            <p className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]">
              Select Appointment Date
            </p>
            <MonthCalendar
              compact
              year={viewYear}
              monthIndex={viewMonth}
              onPrevMonth={() => shiftMonth(-1)}
              onNextMonth={() => shiftMonth(1)}
              cells={calendarCells}
              footer={
                <div className="flex flex-wrap items-center gap-3 text-[12px] font-medium text-[#64748B]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#0B2A4A]" /> Selected
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#BFDBFE]" /> Open day
                  </span>
                </div>
              }
            />
            {doctorId && !schedulesQuery.isLoading && openDates.size === 0 ? (
              <p className="mt-2 text-[13px] text-[#B45309]">
                No open schedules for this doctor yet. Create one on the Schedules page.
              </p>
            ) : null}
          </div>

          <div className="my-5 border-t border-[#EEF2F6]" />

          {/* Patient Information Section: Reordered to place Contact Number FIRST */}
          <label className="block">
            <span className="text-[13px] font-semibold text-[#374151]">Contact Number</span>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#5B6577]">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6.5 3.5h3l1.2 4-2 1.2a12 12 0 0 0 5.6 5.6l1.2-2 4 1.2v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
                </svg>
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={patientPhone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPatientPhone(val);
                  // Reset dismissed state so entering/editing phone number triggers new patient search.
                  setDismissedSuggestions(false);
                }}
                placeholder="Enter 10-digit mobile number"
                className="w-full rounded-xl border border-[#E5EAF0] bg-white py-2.5 pl-10 pr-3.5 text-[14px] outline-none placeholder:text-[#9AA3B2] focus:border-[#1B64F2]"
              />
            </div>
          </label>

          {/* Show a non-blocking loading state while searching previous patients */}
          {patientLookupQuery.isFetching && patientPhone.length === 10 && !dismissedSuggestions ? (
            <p className="mt-2 text-[12.5px] font-medium text-[#64748B]">Searching previous patients...</p>
          ) : null}

          {/* Display unique patients previously booked with this phone number while keeping booking account owner separate from actual patient */}
          {patientLookupQuery.data && patientLookupQuery.data.length > 0 && !dismissedSuggestions ? (
            <div className="mt-2.5 rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#475569]">Previously used patients</span>
                {/* Allow admins to dismiss existing patient suggestions when the same phone number is being used for a new patient */}
                <button
                  type="button"
                  onClick={() => setDismissedSuggestions(true)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#E2E8F0] hover:text-[#475569]"
                  aria-label="Close suggestions"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {patientLookupQuery.data.map((p, idx) => (
                  <button
                    key={`${p.name}_${p.age ?? idx}`}
                    type="button"
                    // Auto-fill patient's actual name and age when a suggestion is clicked.
                    onClick={() => {
                      setPatientName(p.name);
                      setPatientAge(p.age != null ? String(p.age) : '');
                    }}
                    className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-left transition hover:border-[#1B64F2] hover:bg-[#F0F5FF]"
                  >
                    <span className="text-[13.5px] font-semibold text-[#0F172A]">{p.name}</span>
                    {p.age != null ? (
                      <span className="text-[12.5px] font-medium text-[#64748B]">{p.age} yrs</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-[1fr_100px] gap-3">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#374151]">Full Name</span>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter full name"
                className="mt-1.5 w-full rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-2.5 text-[14px] outline-none placeholder:text-[#9AA3B2] focus:border-[#1B64F2]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#374151]">Age</span>
              <input
                type="text"
                inputMode="numeric"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Enter age"
                className="mt-1.5 w-full rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-2.5 text-[14px] outline-none placeholder:text-[#9AA3B2] focus:border-[#1B64F2]"
              />
            </label>
          </div>

          {scheduleOk ? (
            <p className="mt-3 text-[13px] text-[#4B5563]">
              Next free token for this day: <span className="font-bold text-[#0B2A4A]">#{nextToken}</span>
            </p>
          ) : null}

          {error ? <p className="mt-3 text-sm text-[#DC2626]">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#EEF2F6] bg-white px-5 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#0B2A4A] px-4 py-2.5 text-[14px] font-semibold text-[#0B2A4A] transition hover:bg-[#F5F8FC]"
          >
            Cancel
          </button>
          <Button
            type="button"
            variant="navy"
            loading={bookOffline.isPending}
            disabled={!canSubmit}
            onClick={handleConfirm}
          >
            Confirm Booking
          </Button>
        </div>
      </div>
    </div>
  );
};
