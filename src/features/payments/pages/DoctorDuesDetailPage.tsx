import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { BackButton } from '@/components/ui/BackButton';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { 
  billingService, 
  type AdminDuesDoctorOrdersResponse, 
  type AdminDuesBreakdown 
} from '@/api/services/billing/billing.service';
import type { SummaryContextType } from './PaymentSummaryPage';
import { PatientDetailsModal } from '../components/PatientDetailsModal';
import { getApiErrorMessage } from '@/api/client';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

export const DoctorDuesDetailPage = () => {
  const { monthKey, doctorId } = useParams<{ monthKey: string; doctorId: string }>();
  const navigate = useNavigate();
  // Use the context provided by PayAarohCarePage's Outlet to get the overall month status
  const context = useOutletContext<SummaryContextType>();

  const [data, setData] = useState<AdminDuesDoctorOrdersResponse | null>(null);
  const [doctorsList, setDoctorsList] = useState<AdminDuesBreakdown['doctors']>([]);
  const [loading, setLoading] = useState(true);

  const [patientFilter, setPatientFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Online' | 'Offline'>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });
  
  // State for cancelled details modal
  const [selectedOrder, setSelectedOrder] = useState<AdminDuesDoctorOrdersResponse['orders'][0] | null>(null);

  // Fetch both the detailed orders for the selected doctor AND the overall breakdown to populate the doctor dropdown.
  useEffect(() => {
    if (!monthKey || !doctorId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [ordersRes, breakdownRes] = await Promise.all([
          billingService.getAdminDuesDoctorOrders(doctorId, monthKey),
          billingService.getAdminDuesBreakdownByDoctor(monthKey)
        ]);
        setData(ordersRes);
        setDoctorsList(breakdownRes.doctors);
        
        // Reset filters on doctor change
        setPatientFilter('ALL');
      } catch {
        showToast('Failed to load doctor dues details', 'error');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [monthKey, doctorId]);

  const [isRefunding, setIsRefunding] = useState(false);

  const handleRefund = async (appointmentId: string) => {
    try {
      setIsRefunding(true);
      await billingService.markPatientRefunded(appointmentId);
      showToast('Patient refund recorded as completed!', 'success');
      // Refetch data
      const [ordersRes, breakdownRes] = await Promise.all([
        billingService.getAdminDuesDoctorOrders(doctorId || '', monthKey || ''),
        billingService.getAdminDuesBreakdownByDoctor(monthKey || '')
      ]);
      setData(ordersRes);
      setDoctorsList(breakdownRes.doctors);
      
      // Update the modal with fresh backend data so the user sees the 'Refunded' state
      const updatedOrder = ordersRes.orders.find(o => o._id === appointmentId);
      if (updatedOrder) {
        setSelectedOrder(updatedOrder);
      } else {
        setSelectedOrder(null);
      }
    } catch (err) {
      showToast(getApiErrorMessage(err) || 'Failed to process refund', 'error');
    } finally {
      setIsRefunding(false);
    }
  };

  const handleDoctorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDoctorId = e.target.value;
    if (newDoctorId !== doctorId) {
      navigate(`/admin/pay/summary/${monthKey}/doctor/${newDoctorId}`);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Derive dynamic patient list based on the loaded orders so the dropdown only shows relevant patients.
  const uniquePatients = useMemo(() => {
    if (!data) return [];
    const patientsMap = new Map();
    data.orders.forEach(o => {
      if (o.patient) {
        patientsMap.set(o.patient._id, o.patient);
      }
    });
    return Array.from(patientsMap.values());
  }, [data]);

  // Apply filters and sorting
  const filteredAndSortedOrders = useMemo(() => {
    if (!data) return [];
    let result = [...data.orders];

    if (patientFilter !== 'ALL') {
      result = result.filter(o => o.patient?._id === patientFilter);
    }
    
    // Apply the type filter using the existing QUEUE-based booking definition so Online/Offline counts remain consistent across AarohaCare.
    if (typeFilter !== 'ALL') {
      result = result.filter(o => o.type === typeFilter);
    }

    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortConfig.key) {
        case 'date':
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
          break;
        case 'patient':
          valA = a.patient?.name || '';
          valB = b.patient?.name || '';
          break;
        case 'type':
          valA = a.type;
          valB = b.type;
          break;
        case 'serviceFee':
          valA = a.serviceFee;
          valB = b.serviceFee;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, patientFilter, typeFilter, sortConfig]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading details..." />
      </div>
    );
  }

  if (!data) return null;

  const dateObj = new Date(`${monthKey}-01T00:00:00Z`);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const yearStr = dateObj.getUTCFullYear().toString();

  // Compute summary values from ACTUAL returned orders
  const totalBookings = data.orders.length;
  const onlineCount = data.orders.filter(o => o.type === 'Online').length;
  const offlineCount = data.orders.filter(o => o.type === 'Offline').length;
  const totalPayment = data.orders.reduce((sum, o) => sum + (o.serviceFee || 0), 0);

  // Since platform dues are paid globally by the facility, we use the parent record's status.
  const isPaid = context?.record?.status === 'PAID';
  const paymentStatus = isPaid ? (totalPayment > 0 ? 'Payment Completed' : 'All Settled') : 'Payment Pending';

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 pb-10">
      <div>
        <BackButton onClick={() => navigate(`/admin/pay/summary/${monthKey}`)}>Back</BackButton>
      </div>

      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] sm:text-[32px]">{data.doctor.name}</h1>
        <p className="mt-1 text-[14px] font-medium text-[#64748B]">
          {monthName} {yearStr}
        </p>
      </div>

      {/* Filter Section */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[12px] font-bold text-[#64748B]">Doctor</label>
          <select 
            value={doctorId} 
            onChange={handleDoctorChange}
            className="rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] px-3 py-2 text-[14px] font-medium text-[#0F172A] outline-none focus:border-[#3B82F6]"
          >
            {doctorsList.map(doc => (
              <option key={doc.doctorId} value={doc.doctorId}>{doc.doctorName}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[12px] font-bold text-[#64748B]">Patient</label>
          <select 
            value={patientFilter} 
            onChange={(e) => setPatientFilter(e.target.value)}
            className="rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] px-3 py-2 text-[14px] font-medium text-[#0F172A] outline-none focus:border-[#3B82F6]"
          >
            <option value="ALL">All patients</option>
            {uniquePatients.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 text-[#0F172A] shadow-sm">
          <p className="text-[12px] font-medium text-[#64748B]">Bookings</p>
          <p className="mt-1 text-[24px] font-bold leading-none">{totalBookings}</p>
        </div>
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 text-[#0F172A] shadow-sm">
          <p className="text-[12px] font-medium text-[#64748B]">Online / Offline</p>
          <p className="mt-1 text-[24px] font-bold leading-none">{onlineCount} / {offlineCount}</p>
        </div>
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 text-[#0F172A] shadow-sm">
          <p className="text-[12px] font-medium text-[#64748B]">Payment</p>
          <p className="mt-1 text-[24px] font-bold leading-none">₹{totalPayment}</p>
        </div>
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 text-[#0F172A] shadow-sm flex flex-col justify-center items-start">
          <p className="text-[12px] font-medium text-[#64748B] mb-2">Status</p>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold ${isPaid ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEF3C7] text-[#D97706]'}`}>
            {paymentStatus}
          </span>
        </div>
      </div>

      {/* Booking Table */}
      <div className="rounded-2xl border border-[#E5EAF0] bg-white shadow-sm overflow-hidden text-[#0F172A] mt-6">
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#E5EAF0] text-[#64748B]">
                <th className="py-3 font-medium cursor-pointer hover:text-[#0F172A]" onClick={() => handleSort('date')}>Date</th>
                <th className="py-3 font-medium cursor-pointer hover:text-[#0F172A]" onClick={() => handleSort('patient')}>Patient</th>
                <th className="py-3 font-medium cursor-pointer hover:text-[#0F172A]">Doctor</th>
                <th className="py-3 font-medium">
                  <div className="flex flex-col gap-1">
                    <span>Type</span>
                    <select 
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'Online' | 'Offline')}
                      className="bg-white text-[#0F172A] border border-[#E5EAF0] rounded px-2 py-1 text-[12px] outline-none"
                    >
                      <option value="ALL">All</option>
                      <option value="Online">Online</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                </th>
                <th className="py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('serviceFee')}>Service fee</th>
                <th className="py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('status')}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">No bookings found for the selected filters.</td>
                </tr>
              ) : (
                filteredAndSortedOrders.map(order => {
                  const dateStr = new Date(order.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                  return (
                    // Make the entire booking row interactive so users can open the same detailed booking view by clicking anywhere on the selected appointment.
                    <tr 
                      key={order._id} 
                      className="border-b border-[#E5EAF0] transition cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="py-4">{dateStr}</td>
                      <td className="py-4 font-medium">{order.patient?.name || '-'}</td>
                      <td className="py-4">{data.doctor.name}</td>
                      <td className="py-4">
                        <span className="inline-flex rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-[12px] font-bold text-[#0369A1]">
                          {order.type}
                        </span>
                      </td>
                      <td className="py-4 font-medium text-[#0F172A]">₹{order.serviceFee}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                          order.status === 'CANCELLED' ? 'text-red-700 bg-red-100' : 
                          order.status === 'COMPLETED' ? 'text-[#047857] bg-[#D1FAE5]' : 
                          'text-[#D97706] bg-[#FEF3C7]'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div className="flex flex-col items-center justify-center border-t border-[#E5EAF0] p-6 bg-slate-50">
          <p className="text-[13px] text-[#64748B] mb-4">Tap a cancelled booking to see patient and refund details.</p>
          <span className="inline-flex rounded-full bg-[#D1FAE5] px-3 py-1 text-[13px] font-bold text-[#047857]">
            Nothing pending
          </span>
        </div>
      </div>

      {/* Open the existing booking-details component with the clicked appointment so users can inspect the complete booking and refund information without creating a duplicate detail view. */}
      <PatientDetailsModal 
        appointment={selectedOrder}
        doctorName={data?.doctor?.name}
        onClose={() => setSelectedOrder(null)}
        onRefund={handleRefund}
        isRefunding={isRefunding}
      />
    </div>
  );
};
