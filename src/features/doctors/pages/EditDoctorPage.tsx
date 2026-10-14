import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { uploadsService } from '@/api/services/uploads';
import { ImageCropModal } from '@/components/media/ImageCropModal';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { SpecializationAutocomplete } from '@/components/ui/SpecializationAutocomplete';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useDoctors, useUpdateDoctor } from '@/hooks/useDoctors';

const DOCTOR_PHOTO_ASPECT = 1;
const fieldClass =
  'w-full rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-3 text-[15px] text-[#1A1F36] outline-none transition placeholder:text-[#6B7280] focus:border-[#1B64F2] focus:ring-2 focus:ring-[#1B64F2]/15';
const labelClass = 'text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]';

export const EditDoctorPage = () => {
  const { doctorId = '' } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { data: doctors = [], isLoading, isError, error } = useDoctors();
  const updateDoctor = useUpdateDoctor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doctor = doctors.find((item) => item._id === doctorId);

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
  const [logoUrl, setLogoUrl] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [rawPickedSrc, setRawPickedSrc] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [hydratedId, setHydratedId] = useState('');

  useEffect(() => {
    if (!doctor || hydratedId === doctor._id) return;
    setName(doctor.name || '');
    setSpecialization(doctor.specialization || '');
    setQualifications(doctor.qualifications || '');
    setConsultationFee(
      doctor.consultationFee != null ? String(doctor.consultationFee) : '',
    );
    setPhone(doctor.phone || '');
    setEmail(doctor.email || '');
    const bank = (doctor as any).bankAccountDetails || {};
    setAccountNumber(bank.accountNumber || '');
    setIfscCode(bank.ifscCode || '');
    setBankName(bank.bankName || '');
    setAccountHolderName(bank.accountHolderName || '');
    setUpiId(bank.upiId || '');
    setLogoUrl(doctor.profileImage || '');
    setProfileFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setHydratedId(doctor._id);
  }, [doctor, hydratedId]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      if (rawPickedSrc) URL.revokeObjectURL(rawPickedSrc);
    },
    // Revoke latest blob URLs on unmount only.
    [rawPickedSrc],
  );

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
    if (!doctor) return;
    setFormError('');
    if (!name.trim()) {
      setFormError('Full name is required');
      return;
    }
    if (!specialization.trim()) {
      setFormError('Specialization is required');
      return;
    }
    if (!consultationFee || isNaN(Number(consultationFee)) || Number(consultationFee) < 0 || !/^\d*\.?\d{0,2}$/.test(String(consultationFee).trim()) || String(consultationFee).trim() === '.') {
      setFormError('Enter a valid consultation fee with up to 2 decimal places.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Contact number is required');
      return;
    }

    try {
      let profileImage = logoUrl || undefined;
      if (profileFile) {
        setUploading(true);
        const uploaded = await uploadsService.image(profileFile, 'aarohcare/doctors');
        profileImage = uploaded.url;
      }

      await updateDoctor.mutateAsync({
        doctorId: doctor._id,
        body: {
          name: name.trim(),
          specialization: specialization.trim() || undefined,
          qualifications: qualifications.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          consultationFee: consultationFee ? Number(consultationFee) : undefined,
          profileImage,
          bankAccountDetails: accountNumber || ifscCode || upiId ? {
            accountNumber: accountNumber.trim() || undefined,
            ifscCode: ifscCode.trim() || undefined,
            bankName: bankName.trim() || undefined,
            accountHolderName: accountHolderName.trim() || undefined,
            upiId: upiId.trim() || undefined,
          } : undefined,
        } as any,
      });
      showToast('Doctor profile updated');
      navigate(APP_ROUTES.ADMIN.DOCTOR_DETAIL(doctor._id), { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err);
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <Spinner label="Loading doctor…" />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
        <p className="text-sm text-[#DC2626]">Doctor not found.</p>
        <BackButton to={APP_ROUTES.ADMIN.DOCTORS}>Back to Doctors List</BackButton>
      </div>
    );
  }

  const displayedPhoto = previewUrl || logoUrl;
  const saving = uploading || updateDoctor.isPending;

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
          <BackButton to={APP_ROUTES.ADMIN.DOCTOR_DETAIL(doctor._id)}>
            Back to Doctor Profile
          </BackButton>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8"
      >
        <h2 className="mb-6 text-[20px] font-bold text-[#1A1F36]">Edit Doctor Profile</h2>

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
          {displayedPhoto ? (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E5EAF0] bg-[#F8FAFC] p-4">
              <img
                src={displayedPhoto}
                alt=""
                className="h-24 w-24 rounded-2xl object-cover ring-2 ring-white shadow-xs"
              />
              <div className="flex flex-col gap-2">
                <p className="text-[14px] font-semibold text-[#1A1F36]">
                  {previewUrl ? 'New photo ready' : 'Current profile photo'}
                </p>
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
          <Field label="Full Name" required>
            <input
              className={fieldClass}
              placeholder="Enter doctor name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <SpecializationAutocomplete
            label="Specialization"
            required
            value={specialization}
            onChange={setSpecialization}
            placeholder="Select specialization"
          />
          <Field label="Qualifications">
            <input
              className={fieldClass}
              placeholder="Enter qualifications"
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
            />
          </Field>
          <Field label="Consultation Fee" required>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[14px] font-semibold text-[#5B6577]">
                ₹
              </span>
              <input
                className={`${fieldClass} pl-8`}
                placeholder="Enter consultation fee"
                inputMode="decimal"
                value={consultationFee}
                onChange={(e) => {
                  // Keep the fee as a string while typing so intermediate values like "300." remain valid input.
                  const val = e.target.value.replace(/[^\d.]/g, '').match(/^\d*\.?\d{0,2}/)?.[0] || '';
                  setConsultationFee(val);
                }}
              />
            </div>
          </Field>
        </div>

        <div className="my-6 border-t border-[#EEF2F6]" />

        <h3 className="text-sm font-bold text-[#0F172A] mb-3">Bank & UPI Settlement Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account Holder Name">
            <input
              className={fieldClass}
              placeholder="Enter account holder name"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
            />
          </Field>
          <Field label="Bank Name">
            <input
              className={fieldClass}
              placeholder="Enter bank name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
          <Field label="Account Number">
            <input
              className={fieldClass}
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </Field>
          <Field label="IFSC Code">
            <input
              className={fieldClass}
              placeholder="Enter 11-digit IFSC code"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Doctor UPI ID (for 1-tap transfer)">
            <input
              className={fieldClass}
              placeholder="Enter UPI ID"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact Number" required>
            <input
              className={fieldClass}
              placeholder="Enter 10-digit mobile number"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="Email Address">
            <input
              className={fieldClass}
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>

        {formError ? <p className="mt-4 text-[13px] text-[#DC2626]">{formError}</p> : null}

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
  children,
}: {
  label: string;
  required?: boolean;
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
  </div>
);
