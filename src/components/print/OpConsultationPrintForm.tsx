import React, { useEffect } from 'react';
import { useMyFacility } from '@/hooks/useFacility';

export interface OpConsultationFormData {
  doctorName?: string;
  department?: string;
  date?: string;
  patientName?: string;
  tokenNumber?: number | string;
  opNumber?: string;
  age?: number | string;
  gender?: string;
  phone?: string;
  place?: string;
  address?: string;
  bp?: string;
  temp?: string;
}

export interface OpFacilityInfo {
  name?: string;
  facilityType?: string;
  address?: string;
  place?: string;
  phone?: string;
  email?: string;
  image?: string;
  registrationNumber?: string;
}

interface OpConsultationPrintFormProps {
  data: OpConsultationFormData;
  facility?: OpFacilityInfo | null;
  onClose?: () => void;
  autoPrint?: boolean;
}

export const formatGenderCode = (gender?: string) => {
  if (!gender) return '';
  const g = gender.trim().toLowerCase();
  if (g.startsWith('f')) return 'F';
  if (g.startsWith('m')) return 'M';
  if (g.startsWith('o')) return 'O';
  return gender.toUpperCase();
};

export const formatDisplayDate = (dateVal?: string) => {
  if (!dateVal) {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}-${m}-${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    const [y, m, d] = dateVal.slice(0, 10).split('-');
    return `${d}-${m}-${y}`;
  }
  const dateObj = new Date(dateVal);
  if (!isNaN(dateObj.getTime())) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return dateVal;
};

// Dedicated printable A4 OP Consultation Form matching the reference template
export const OpConsultationPrintForm: React.FC<OpConsultationPrintFormProps> = ({
  data,
  facility: facilityProp,
  onClose,
  autoPrint = true,
}) => {
  const { data: myFacility } = useMyFacility();
  const facility = facilityProp || myFacility;

  const clinicName = facility?.name || 'AarohaCare Healthcare';
  const clinicType =
    facility?.facilityType === 'HOSPITAL' ? 'Multi-speciality Hospital' : 'Multi-speciality Clinic';
  const clinicAddress =
    facility?.address || facility?.place || '';
  const clinicPhone = facility?.phone || '';
  const clinicReg = (facility as any)?.registrationNumber || (facility as any)?.regNo || '';
  const clinicEmail = facility?.email || '';
  const clinicWebsite = facility?.email?.includes('@')
    ? `www.${facility.email.split('@')[1]}`
    : 'www.aarohacare.com';

  // Do not display hardcoded sample strings if data is unavailable - leave field blank per instructions
  const doctorName = data.doctorName
    ? `Dr. ${data.doctorName.replace(/^dr\.?\s*/i, '')}`
    : '';
  const department = data.department || '';
  const consultDate = formatDisplayDate(data.date);
  const patientName = data.patientName || '';
  const opNo =
    data.opNumber ||
    (data.tokenNumber != null && data.tokenNumber !== ''
      ? `OP-${String(data.tokenNumber).padStart(6, '0')}`
      : '');

  const genderCode = formatGenderCode(data.gender);
  const ageVal = data.age != null && data.age !== '' ? String(data.age) : '';
  const ageSex =
    ageVal && genderCode
      ? `${ageVal} / ${genderCode}`
      : ageVal || genderCode || '';

  const patientPhone = data.phone || '';
  const patientPlace = data.place || data.address || '';

  // Trigger print dialog on mount if autoPrint is true
  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => {
      window.print();
    }, 280);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide entire web app UI during print */
          body > * {
            visibility: hidden !important;
          }

          /* Show only the consultation print root */
          #op-consultation-print-root,
          #op-consultation-print-root * {
            visibility: visible !important;
          }

          #op-consultation-print-root {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            z-index: 999999 !important;
            overflow: hidden !important;
          }

          .no-print {
            display: none !important;
          }

          .print-a4-sheet {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Overlay in regular view */}
      <div
        id="op-consultation-print-root"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-start overflow-y-auto bg-slate-900/60 p-2 sm:p-6 backdrop-blur-xs"
      >
        {/* Top interactive preview bar (hidden in print) */}
        <div className="no-print mb-4 flex w-full max-w-[210mm] items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1E4287]">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">A4 OP Consultation Form Preview</p>
              <p className="text-xs text-slate-500">Ready to print for {patientName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E4287] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#163266] active:scale-95"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print Form</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* The Exact Printable A4 Sheet */}
        <div className="print-a4-sheet relative flex h-[297mm] w-[210mm] flex-col justify-between overflow-hidden bg-white shadow-2xl text-slate-800">
          {/* Top Bar Accent */}
          <div className="h-[5px] w-full bg-[#1E4287]" />

          {/* Sheet Inner Content */}
          <div className="flex flex-1 flex-col justify-between px-[14mm] py-[8mm]">
            <div>
              {/* Header: Clinic Logo, Clinic Details & Powered by AarohaCare */}
              <div className="flex items-start justify-between gap-4">
                {/* Left: Logo and Clinic Name */}
                <div className="flex items-start gap-4">
                  {facility?.image ? (
                    <img
                      src={facility.image}
                      alt={clinicName}
                      className="h-[68px] w-[68px] shrink-0 rounded-lg object-contain border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>CLINIC</span>
                      <span>LOGO</span>
                    </div>
                  )}

                  <div className="flex flex-col">
                    <h1 className="text-[22px] font-extrabold leading-tight text-[#1E4287]">
                      {clinicName}
                    </h1>
                    <p className="mt-0.5 text-[12.5px] font-bold text-slate-700">
                      {clinicType}
                    </p>
                    <p className="mt-1 text-[11px] font-medium leading-tight text-slate-600">
                      {clinicAddress}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                      Ph: {clinicPhone} · Reg. No. {clinicReg}
                    </p>
                  </div>
                </div>

                {/* Right: Divider & AarohaCare Branding */}
                <div className="flex items-center gap-3">
                  <div className="h-14 w-[1px] bg-slate-200" />
                  <div className="flex flex-col items-end">
                    <p className="text-[8.5px] font-bold tracking-[0.2em] uppercase text-slate-400">
                      POWERED BY
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <img
                        src="/aarohcare-logo.png"
                        alt="AarohCare"
                        className="h-6 w-6 object-contain"
                      />
                      <span className="text-[17px] font-extrabold tracking-tight text-[#1E4287]">
                        AarohCare
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] italic text-[#2563EB]">
                      Our time, our health.
                    </p>
                  </div>
                </div>
              </div>

              {/* Departments Strip */}
              <div className="mt-3.5 flex items-center gap-2.5 border-y border-slate-200 py-1.5 text-[11px]">
                <span className="shrink-0 text-[11px] font-extrabold tracking-wider text-[#1E4287]">
                  DEPARTMENTS
                </span>
                <span className="truncate font-medium text-slate-600">
                  General Medicine · Paediatrics · Gynaecology · Orthopaedics · Dermatology · ENT · Dental
                </span>
              </div>

              {/* Patient and Appointment Details Grid */}
              <div className="mt-3.5 space-y-2.5 text-[12.5px]">
                {/* Row 1: Doctor name, Department, Date */}
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex min-w-[240px] items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Doctor name</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900">
                      {doctorName}
                    </span>
                  </div>

                  <div className="flex min-w-[170px] items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Department</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900">
                      {department}
                    </span>
                  </div>

                  <div className="flex min-w-[140px] items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Date</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900 text-right sm:text-left">
                      {consultDate}
                    </span>
                  </div>
                </div>

                {/* Row 2: Patient name, OP No. */}
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex flex-1 items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Patient name</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900">
                      {patientName}
                    </span>
                  </div>

                  <div className="flex min-w-[160px] items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">OP No.</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900">
                      {opNo}
                    </span>
                  </div>
                </div>

                {/* Row 3: Age / Sex, Phone, Place */}
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex min-w-[150px] items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Age / Sex</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900">
                      {ageSex}
                    </span>
                  </div>

                  <div className="flex min-w-[210px] items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Phone</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900">
                      {patientPhone}
                    </span>
                  </div>

                  <div className="flex flex-1 items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Place</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5 font-bold text-slate-900">
                      {patientPlace}
                    </span>
                  </div>
                </div>

                {/* Row 4: BP, Temp */}
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex min-w-[280px] items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">BP</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5"></span>
                  </div>

                  <div className="flex flex-1 items-baseline gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-600">Temp</span>
                    <span className="flex-1 border-b border-slate-400 pb-0.5"></span>
                  </div>
                </div>
              </div>

              {/* Consultation Notes Writing Area */}
              <div className="mt-4 min-h-[148mm] rounded-2xl border-2 border-slate-300 bg-white" />
            </div>

            {/* Bottom Row: Next Review & Doctor Signature */}
            <div className="mt-4 flex items-end justify-between px-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] font-semibold text-slate-700">Next review</span>
                <span className="inline-block w-64 border-b border-slate-400 pb-0.5" />
              </div>

              <div className="flex w-60 flex-col items-center">
                <div className="w-full border-t border-slate-400" />
                <span className="mt-1 text-[11.5px] font-semibold text-slate-600">
                  Doctor's signature & seal
                </span>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between bg-[#1E4287] px-[14mm] py-2.5 text-[11.5px] font-medium text-white">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{clinicWebsite}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>{clinicEmail}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>{clinicPhone}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
