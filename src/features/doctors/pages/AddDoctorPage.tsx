import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { uploadsService } from '@/api/services/uploads';
import { ImageCropModal } from '@/components/media/ImageCropModal';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { SpecializationAutocomplete } from '@/components/ui/SpecializationAutocomplete';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useAddDoctor } from '@/hooks/useDoctors';

const DOCTOR_PHOTO_ASPECT = 1;
const fieldClass = (hasError?: boolean) =>
  `w-full rounded-xl border ${hasError ? 'border-red-500' : 'border-[#E5EAF0]'} bg-white px-3.5 py-3 text-[15px] text-[#1A1F36] outline-none transition placeholder:text-[#6B7280] focus:border-[#1B64F2] focus:ring-2 focus:ring-[#1B64F2]/15`;
const labelClass = 'text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]';

export const AddDoctorPage = () => {
  const navigate = useNavigate();
  const addDoctor = useAddDoctor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [rawPickedSrc, setRawPickedSrc] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [uploading, setUploading] = useState(false);

  const closeCrop = () => {
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePick = (file: File | null) => {
    if (!file) return;
    if (rawPickedSrc) URL.revokeObjectURL(rawPickedSrc);
    const src = URL.createObjectURL(file);
    setRawPickedSrc(src);
    setCropSrc(src);
  };

  const handleCropConfirm = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setProfileFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    closeCrop();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    
    // Apply local validation matching the mobile/patient app pattern
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Doctor name is required.';
    } else if (name.trim().length < 2) {
      nextErrors.name = 'Doctor name must be at least 2 characters.';
    } else if (name.trim().length > 40) {
      nextErrors.name = 'Doctor name cannot exceed 40 characters.';
    } else if (!/^[A-Za-z\s.'-]+$/.test(name.trim()) || !/[A-Za-z]/.test(name.trim())) {
      nextErrors.name = 'Enter a valid doctor name using letters only.';
    }

    if (!specialization.trim()) {
      nextErrors.specialization = 'Specialization is required';
    }

    if (!consultationFee.trim()) {
      nextErrors.consultationFee = 'Consultation fee is required.';
    } else if (isNaN(Number(consultationFee)) || Number(consultationFee) < 0 || !/^\d*\.?\d{0,2}$/.test(consultationFee.trim()) || consultationFee.trim() === '.') {
      nextErrors.consultationFee = 'Enter a valid consultation fee with up to 2 decimal places.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      nextErrors.phone = 'Contact number is required';
    } else if (cleanPhone.length !== 10) {
      nextErrors.phone = 'Please enter a valid 10-digit mobile number';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Please enter a valid email address';
    }

    if (ifscCode.trim() && ifscCode.trim().length !== 11) {
      nextErrors.ifscCode = 'IFSC code must be exactly 11 characters';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      let profileImage: string | undefined;
      if (profileFile) {
        setUploading(true);
        const uploaded = await uploadsService.image(profileFile, 'aarohcare/doctors');
        profileImage = uploaded.url;
      }

      await addDoctor.mutateAsync({
        name: name.trim(),
        specialization: specialization.trim(),
        qualifications: qualifications.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        consultationFee: Number(consultationFee),
        profileImage,
        bankAccountDetails: accountNumber || ifscCode || upiId ? {
          accountNumber: accountNumber.trim() || undefined,
          ifscCode: ifscCode.trim() || undefined,
          bankName: bankName.trim() || undefined,
          accountHolderName: accountHolderName.trim() || undefined,
          upiId: upiId.trim() || undefined,
        } : undefined,
      } as any);
      showToast('Doctor profile saved');
      navigate(APP_ROUTES.ADMIN.DOCTORS, { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const saving = uploading || addDoctor.isPending;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      {cropSrc ? (
        <ImageCropModal
          imageSrc={cropSrc}
          aspect={DOCTOR_PHOTO_ASPECT}
          title="Crop doctor photo"
          confirmLabel="Use photo"
          onCancel={closeCrop}
          onConfirm={handleCropConfirm}
        />
      ) : null}

      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#1A1F36] sm:text-[32px]">
          Manage Doctors
        </h1>
        <div className="mt-3">
          <BackButton to={APP_ROUTES.ADMIN.DOCTORS}>Back to Doctors List</BackButton>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8"
      >
        <h2 className="mb-6 text-[20px] font-bold text-[#1A1F36]">Add New Doctor</h2>

        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              handlePick(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          {previewUrl ? (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E5EAF0] bg-[#F8FAFC] p-4">
              <img
                src={previewUrl}
                alt=""
                className="h-24 w-24 rounded-2xl object-cover ring-2 ring-white shadow-xs"
              />
              <div className="flex flex-col gap-2">
                <p className="text-[14px] font-semibold text-[#1A1F36]">Profile photo ready</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="self-start rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                  >
                    Change Photo
                  </button>
                  {rawPickedSrc ? (
                    <button
                      type="button"
                      onClick={() => setCropSrc(rawPickedSrc)}
                      className="inline-flex items-center gap-1.5 self-start rounded-xl border border-blue-600 bg-blue-50 px-3.5 py-1.5 text-[13px] font-semibold text-blue-700 hover:bg-blue-100 transition shadow-xs"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      Adjust / Move Up & Down
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D7DEE7] bg-[#F8FAFC] px-6 py-10 text-center transition hover:border-[#93C5FD] hover:bg-[#F5F9FF]"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#1B64F2]">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 16V7m0 0 3.5 3.5M12 7 8.5 10.5" />
                  <path d="M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" />
                </svg>
              </span>
              <p className="text-[15px] font-semibold text-[#1A1F36]">Drag and drop photo here</p>
              <p className="text-[13px] text-[#5B6577]">PNG, JPG up to 5MB (Move up/down and zoom in preview)</p>
              <span className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs">
                Browse Files
              </span>
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" required error={errors.name}>
            <input
              className={fieldClass(!!errors.name)}
              placeholder="Enter doctor name"
              value={name}
              onChange={(e) => {
                // Restrict doctor names to professional alphabetic names and prevent numeric-only input.
                const validName = e.target.value.replace(/[^A-Za-z\s.'-]/g, '').slice(0, 40);
                setName(validName);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <SpecializationAutocomplete
              label="Specialization"
              required
              value={specialization}
              onChange={(val) => {
                setSpecialization(val);
                if (errors.specialization) setErrors((prev) => ({ ...prev, specialization: undefined }));
              }}
              placeholder="Select specialization"
            />
            {errors.specialization ? <span className="text-[13px] text-[#DC2626]">{errors.specialization}</span> : null}
          </div>
          <Field label="Qualifications" error={errors.qualifications}>
            <input
              className={fieldClass(!!errors.qualifications)}
              placeholder="Enter qualifications"
              value={qualifications}
              onChange={(e) => {
                setQualifications(e.target.value);
                if (errors.qualifications) setErrors((prev) => ({ ...prev, qualifications: undefined }));
              }}
            />
          </Field>
          <Field label="Consultation Fee" required error={errors.consultationFee}>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[14px] font-semibold text-[#5B6577]">
                ₹
              </span>
              <input
                className={`${fieldClass(!!errors.consultationFee)} pl-8`}
                placeholder="Enter consultation fee"
                inputMode="decimal"
                value={consultationFee}
                onChange={(e) => {
                  // Allow monetary values with up to two decimal places while preventing malformed numeric input.
                  const val = e.target.value.replace(/[^\d.]/g, '').match(/^\d*\.?\d{0,2}/)?.[0] || '';
                  setConsultationFee(val);
                  if (errors.consultationFee) setErrors((prev) => ({ ...prev, consultationFee: undefined }));
                }}
              />
            </div>
          </Field>
        </div>

        <div className="my-6 border-t border-[#EEF2F6]" />

        <h3 className="text-sm font-bold text-[#0F172A] mb-3">Bank & UPI Settlement Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account Holder Name" error={errors.accountHolderName}>
            <input
              className={fieldClass(!!errors.accountHolderName)}
              placeholder="Enter account holder name"
              value={accountHolderName}
              onChange={(e) => {
                setAccountHolderName(e.target.value);
                if (errors.accountHolderName) setErrors((prev) => ({ ...prev, accountHolderName: undefined }));
              }}
            />
          </Field>
          <Field label="Bank Name" error={errors.bankName}>
            <input
              className={fieldClass(!!errors.bankName)}
              placeholder="Enter bank name"
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
                if (errors.bankName) setErrors((prev) => ({ ...prev, bankName: undefined }));
              }}
            />
          </Field>
          <Field label="Account Number" error={errors.accountNumber}>
            <input
              className={fieldClass(!!errors.accountNumber)}
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value);
                if (errors.accountNumber) setErrors((prev) => ({ ...prev, accountNumber: undefined }));
              }}
            />
          </Field>
          <Field label="IFSC Code" error={errors.ifscCode}>
            <input
              className={fieldClass(!!errors.ifscCode)}
              placeholder="Enter 11-digit IFSC code"
              value={ifscCode}
              onChange={(e) => {
                setIfscCode(e.target.value.toUpperCase());
                if (errors.ifscCode) setErrors((prev) => ({ ...prev, ifscCode: undefined }));
              }}
            />
          </Field>
          <Field label="Doctor UPI ID (for 1-tap transfer)" error={errors.upiId}>
            <input
              className={fieldClass(!!errors.upiId)}
              placeholder="Enter UPI ID"
              value={upiId}
              onChange={(e) => {
                setUpiId(e.target.value);
                if (errors.upiId) setErrors((prev) => ({ ...prev, upiId: undefined }));
              }}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact Number" required error={errors.phone}>
            <input
              className={fieldClass(!!errors.phone)}
              placeholder="Enter 10-digit mobile number"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                // Restrict phone input to 10 digits to match the backend doctor contact requirement.
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
            />
          </Field>
          <Field label="Email Address" error={errors.email}>
            <input
              className={fieldClass(!!errors.email)}
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />
          </Field>
        </div>

        {error ? <p className="mt-4 text-[13px] text-[#DC2626]">{error}</p> : null}

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
          <Link
            to={APP_ROUTES.ADMIN.DOCTORS}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 shadow-xs"
          >
            Cancel
          </Link>
          <Button type="submit" variant="navy" loading={saving} className="px-5">
            Save Doctor Profile
          </Button>
        </div>
      </form>
    </div>
  );
};

const Field = ({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <label className={labelClass}>
        {label} {required ? <span className="text-red-500 font-bold">*</span> : null}
      </label>
      {required ? (
        <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600 border border-red-200">
          Required
        </span>
      ) : (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Optional
        </span>
      )}
    </div>
    {children}
    {error ? <span className="text-[13px] text-[#DC2626]">{error}</span> : null}
  </div>
);
