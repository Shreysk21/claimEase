import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageTransition } from '../../components/layout/PageTransition';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SLABadge } from '../../components/ui/SLABadge';
import { GradientButton } from '../../components/ui/GradientButton';
import { formatCurrency, cn } from '../../lib/utils';
import { 
  Claim, 
  Document, 
  HospitalCheckResponse, 
  CalculationResponse,
  WorkflowHistoryResponse
} from '../../types';
import { 
  ArrowLeft, 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  Stethoscope, 
  IndianRupee, 
  Calculator, 
  Stamp,
  Check,
  X,
  MessageSquare,
  AlertCircle,
  File,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  ScanText,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';;
import toast from 'react-hot-toast';
import { getClaimDocuments, getClaimWorkflowHistory, getDocumentViewUrl, getOfficerClaimDetails } from '../../api/mrs';
import api from '../../api/axios';

export const ClaimReviewPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [claim, setClaim] = useState<Claim | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [hospitalCheck, setHospitalCheck] = useState<HospitalCheckResponse | null>(null);
  const [calculation, setCalculation] = useState<CalculationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSanctionConfirm, setShowSanctionConfirm] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'QUERY' | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [overrideAmount, setOverrideAmount] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistoryResponse[]>([]);

  const safeDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (value?: string | null) => {
    const date = safeDate(value);
    return date ? format(date, 'MMM dd, yyyy') : '-';
  };

  const daysSince = (value?: string | null) => {
    const date = safeDate(value);
    return date ? differenceInDays(new Date(), date) : 0;
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      setOpeningDocId(documentId);
      const data = await getDocumentViewUrl(documentId);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningDocId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [claimData, documentData, workflowData] = await Promise.all([
          getOfficerClaimDetails(id),
          getClaimDocuments(id),
          getClaimWorkflowHistory(id),
        ]);

        setClaim(claimData);
        setDocuments(documentData as unknown as Document[]);
        setWorkflowHistory(workflowData);

        if (user?.role === 'MEDICAL_OFFICER') {
          const { data } = await api.get(`/medical/${id}/hospital-check`);
          setHospitalCheck({
            hospital_name: data.hospital_name,
            is_empanelled: true,
            empanelment_tier: data.hospital_type ?? null,
            warning: null,
          });
        }

        if (user?.role === 'FINANCE_OFFICER') {
          const { data } = await api.get(`/finance/${id}/calculate`);
          setCalculation({
            system_calculated: data.system_calculated,
            claimed_amount: data.claimed_amount,
            breakdown: data.breakdown ?? [],
          });
        }
      } catch {
        setError('Unable to load claim details. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user?.role]);

  // const handleAction = async (action: 'APPROVE' | 'REJECT' | 'QUERY' |) => {
    // setActionLoading(true);
    // Mock API call
    // setTimeout(() => {
      // setActionLoading(false);
      // setShowSuccessAnimation(true);
      // setTimeout(() => {
        // setShowSuccessAnimation(false);
        // const rolePrefix = user?.role === 'SCRUTINY_OFFICER' ? 'scrutiny' : 
                          // user?.role === 'MEDICAL_OFFICER' ? 'medical' : 
                          // user?.role === 'FINANCE_OFFICER' ? 'finance' : 'ddo';
        // navigate(`/${rolePrefix}/queue`);
      // }, 1500);
    // }, 1500);
  // };
  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'QUERY') => {
  if (!id || !user?.role) {
    return;
  }

  setActionLoading(true);
  setActionType(action);
  try {
    if (user.role === 'SCRUTINY_OFFICER') {
      if (action === 'APPROVE') await api.post(`/scrutiny/${id}/approve`);
      if (action === 'REJECT') await api.post(`/scrutiny/${id}/reject`, { reason: rejectReason.trim() });
      if (action === 'QUERY') await api.post(`/scrutiny/${id}/query`, { query_message: queryText });
    }
    if (user.role === 'MEDICAL_OFFICER') {
      if (action === 'APPROVE') await api.post(`/medical/${id}/approve`);
      if (action === 'REJECT') await api.post(`/medical/${id}/reject`, { reason: rejectReason.trim() });
      if (action === 'QUERY') await api.post(`/medical/${id}/query`, { query_message: queryText });
    }
    if (user.role === 'FINANCE_OFFICER') {
      if (action === 'APPROVE') {
        const override = overrideAmount.trim() ? Number(overrideAmount) : null;
        if (override !== null && (Number.isNaN(override) || override <= 0)) {
          toast.error('Override amount must be a positive number');
          setActionLoading(false);
          return;
        }
        if (override !== null && !overrideReason.trim()) {
          toast.error('Override reason is required when overriding amount');
          setActionLoading(false);
          return;
        }

        await api.post(`/finance/${id}/approve`, {
          override_amount: override,
          override_reason: override !== null ? overrideReason.trim() : null,
        });
      }
      if (action === 'REJECT') await api.post(`/finance/${id}/reject`, { reason: rejectReason.trim() });
      if (action === 'QUERY') await api.post(`/finance/${id}/query`, { query_message: queryText });
    }
    if (user.role === 'DDO') {
      if (action === 'APPROVE') await api.post(`/ddo/${id}/sanction`);
      if (action === 'REJECT') await api.post(`/ddo/${id}/reject`, { reason: rejectReason.trim() });
      if (action === 'QUERY') await api.post(`/ddo/${id}/query`, { query_message: queryText });
    }

    setActionLoading(false);
    setShowSuccessAnimation(true);

    setTimeout(() => {
      setShowSuccessAnimation(false);

      const rolePrefix =
        user?.role === 'SCRUTINY_OFFICER' ? 'scrutiny' :
        user?.role === 'MEDICAL_OFFICER' ? 'medical' :
        user?.role === 'FINANCE_OFFICER' ? 'finance' : 'ddo';

      navigate(`/${rolePrefix}/queue`);
    }, 1500);
  } catch {
    setActionLoading(false);
  }
};
  if (loading) {
    return (
      <PageTransition>
        <div className="p-8 text-text-secondary">Loading claim details...</div>
      </PageTransition>
    );
  }

  if (error || !claim) {
    return (
      <PageTransition>
        <div className="p-8 space-y-4">
          <p className="text-accent-red">{error || 'Claim not found.'}</p>
          <GradientButton onClick={() => navigate(-1)}>Go Back</GradientButton>
        </div>
      </PageTransition>
    );
  }

  const employeeCode = claim.employeeId
    ? String(claim.employeeId)
    : (claim.user_id ? String(claim.user_id).slice(0, 8).toUpperCase() : '-');
  const hospitalIdDisplay = claim.hospital_id || claim.hospital?.hospital_id || '-';
  const diagnosis = claim.diagnosis || claim.patient?.diagnosis || '-';
  const admissionDate = claim.admission_date || claim.hospital?.admissionDate || null;
  const dischargeDate = claim.discharge_date || claim.hospital?.dischargeDate || null;
  const totalBillAmount = Number(claim.total_bill_amount ?? claim.totalBillAmount ?? 0);
  const eligibleAmount = claim.eligible_reimbursement_amount ?? claim.approvedAmount ?? null;
  const getWorkflowStatusLabel = (stageId: number, remarks?: string | null) => {
    const note = (remarks || '').toLowerCase();
    if (note.includes('query')) return 'QUERY RAISED';
    if (note.includes('reject')) return 'REJECTED';
    if (note.includes('payment')) return 'PAYMENT PROCESSED';

    // workflow_logs.stage_id stores the stage at which action happened.
    // UI should show the resulting stage after that action.
    const nextStageLabel: Record<number, string> = {
      1: 'SUBMITTED',
      2: 'SCRUTINY APPROVED',
      3: 'MEDICAL APPROVED',
      4: 'FINANCE APPROVED',
      5: 'DDO SANCTIONED',
    };
    return nextStageLabel[stageId] || `STAGE ${stageId}`;
  };

  return (
    <PageTransition>
      <div className="space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-white/5 text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white font-space">Reviewing Claim {claim.claim_number}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={claim.claim_status} />
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-text-muted text-[10px] font-bold border border-white/10">
                  ⏱ {daysSince(claim.last_updated_timestamp)} days since last update
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Claim Info Card */}
            <GlassCard className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <FileText className="text-accent-purple" size={20} />
                  <h2 className="text-lg font-bold text-white font-space">Claim Information</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Employee ID</p>
                  <p className="text-sm text-text-primary font-bold">{employeeCode}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Hospital ID</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-text-primary font-medium">{hospitalIdDisplay}</p>
                    {hospitalCheck?.is_empanelled && (
                      <span className="px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green text-[8px] font-bold border border-accent-green/20">EMPANELLED</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Diagnosis</p>
                  <p className="text-sm text-text-primary font-medium">{diagnosis}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Stay Duration</p>
                  <p className="text-sm text-text-primary font-medium">
                    {safeDate(admissionDate) && safeDate(dischargeDate)
                      ? `${differenceInDays(new Date(dischargeDate as string), new Date(admissionDate as string))} Days`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Admission</p>
                  <p className="text-sm text-text-primary font-medium">{formatDate(admissionDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Discharge</p>
                  <p className="text-sm text-text-primary font-medium">{formatDate(dischargeDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Submitted On</p>
                  <p className="text-sm text-text-primary font-medium">{formatDate(claim.submission_timestamp)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Bill Amount</p>
                  <p className="text-2xl font-bold text-white font-space">{formatCurrency(totalBillAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Eligible Reimbursement</p>
                  <p className={cn(
                    "text-2xl font-bold font-space",
                    eligibleAmount ? "text-accent-green" : "text-text-muted"
                  )}>
                    {eligibleAmount ? formatCurrency(eligibleAmount) : 'Pending'}
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Documents Card */}
            <GlassCard className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <ShieldCheck className="text-accent-blue" size={20} />
                <h2 className="text-lg font-bold text-white font-space">Documents Verification</h2>
              </div>
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.document_id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 flex items-center gap-4">
                      <div className="p-3 bg-accent-blue/10 rounded-xl text-accent-blue">
                        <File size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{doc.fileName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-text-muted bg-white/5 px-1.5 py-0.5 rounded">
                            {(doc.fileHash || '').substring(0, 20)}...
                          </span>
                          {!doc.is_tampered && (
                            <span className="px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-[8px] font-bold border border-accent-green/20">VERIFIED</span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleViewDocument(doc.document_id)}
                        disabled={openingDocId === doc.document_id}
                        className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-text-muted transition-colors text-xs border border-white/10"
                      >
                        {openingDocId === doc.document_id ? 'Opening...' : 'View'}
                      </button>
                      <button 
                        onClick={() => setExpandedDoc(expandedDoc === doc.document_id ? null : doc.document_id)}
                        className="p-2 rounded-lg hover:bg-white/5 text-text-muted transition-colors"
                      >
                        {expandedDoc === doc.document_id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {expandedDoc === doc.document_id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5"
                        >
                          <div className="p-6 space-y-6 bg-accent-purple/5">
                            <div className="flex items-center gap-2 text-accent-purple">
                              <BrainCircuit size={18} />
                              <h4 className="text-sm font-bold uppercase tracking-widest">Gemini AI Analysis Report</h4>
                            </div>

                            {doc.ai_analysis ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                    <div className="flex items-center gap-2">
                                      <ScanText size={16} className="text-text-muted" />
                                      <span className="text-xs text-text-muted">Extracted Amount</span>
                                    </div>
                                    <span className="text-sm font-bold text-white">{formatCurrency(doc.ai_analysis.extracted_amount)}</span>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={16} className="text-text-muted" />
                                      <span className="text-xs text-text-muted">Extracted Date</span>
                                    </div>
                                    <span className="text-sm font-bold text-white">{doc.ai_analysis.extracted_date}</span>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 size={16} className="text-text-muted" />
                                      <span className="text-xs text-text-muted">Confidence Score</span>
                                    </div>
                                    <span className="text-sm font-bold text-accent-green">{(doc.ai_analysis.confidence_score * 100).toFixed(1)}%</span>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="p-3 bg-white/5 rounded-xl">
                                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2">AI Summary</span>
                                    <p className="text-xs text-text-secondary leading-relaxed">{doc.ai_analysis.summary}</p>
                                  </div>
                                  {doc.ai_analysis.potential_fraud_flags.length > 0 && (
                                    <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl">
                                      <div className="flex items-center gap-2 text-accent-red mb-2">
                                        <AlertTriangle size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Fraud Flags Detected</span>
                                      </div>
                                      <ul className="list-disc list-inside text-[10px] text-accent-red/80 space-y-1">
                                        {doc.ai_analysis.potential_fraud_flags.map((flag, i) => (
                                          <li key={i}>{flag}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                                <p className="text-sm text-text-muted">No AI analysis available for this document.</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Medical Role Specific Card */}
            {user?.role === 'MEDICAL_OFFICER' && hospitalCheck && (
              <GlassCard className="space-y-6 border-l-4 border-l-accent-green">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <Stethoscope className="text-accent-green" size={20} />
                  <h2 className="text-lg font-bold text-white font-space">Hospital Empanelment Check</h2>
                </div>
                <div className="flex items-center justify-between p-6 bg-accent-green/5 border border-accent-green/10 rounded-2xl">
                  <div>
                    <h3 className="text-xl font-bold text-white font-space">{hospitalCheck.hospital_name}</h3>
                    <p className="text-sm text-text-secondary mt-1">Empanelment Tier: <span className="text-accent-green font-bold">{hospitalCheck.empanelment_tier}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="px-4 py-2 rounded-xl bg-accent-green text-white font-bold text-xs">EMPANELLED</span>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Finance Role Specific Card */}
            {user?.role === 'FINANCE_OFFICER' && calculation && (
              <GlassCard className="space-y-6 border-l-4 border-l-accent-blue">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <Calculator className="text-accent-blue" size={20} />
                  <h2 className="text-lg font-bold text-white font-space">Entitlement Calculation</h2>
                </div>
                
                <div className="overflow-hidden rounded-xl border border-white/5">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-3">Rule</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Cap</th>
                        <th className="px-4 py-3 text-right">Applied</th>
                        <th className="px-4 py-3 text-right">Approved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {calculation.breakdown.map((item, i) => (
                        <tr key={i} className="text-xs">
                          <td className="px-4 py-3 text-text-secondary font-mono">{item.rule}</td>
                          <td className="px-4 py-3 text-text-primary">{item.category}</td>
                          <td className="px-4 py-3 text-right text-text-muted">{formatCurrency(item.cap)}</td>
                          <td className="px-4 py-3 text-right text-white font-bold">{formatCurrency(item.applied_amount)}</td>
                          <td className="px-4 py-3 text-right text-white font-bold">{formatCurrency(item.approved_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CSS Bar Chart */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <span>Amount Breakdown</span>
                    <span>Total: {formatCurrency(calculation.system_calculated)}</span>
                  </div>
                  <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex">
                    <div className="h-full bg-accent-purple" style={{ width: '60%' }} title="Surgery" />
                    <div className="h-full bg-accent-blue" style={{ width: '15%' }} title="Ward" />
                    <div className="h-full bg-accent-green" style={{ width: '25%' }} title="Medicine" />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                      <div className="w-2 h-2 rounded-full bg-accent-purple" /> Surgery
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                      <div className="w-2 h-2 rounded-full bg-accent-blue" /> Ward
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                      <div className="w-2 h-2 rounded-full bg-accent-green" /> Medicine
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-accent-green/10 border border-accent-green/20 rounded-2xl text-center">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">System Calculated Total</p>
                  <p className="text-3xl font-bold text-accent-green font-space">{formatCurrency(calculation.system_calculated)}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Override Amount (Optional)</label>
                    <input
                      type="number"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-purple"
                      placeholder="₹ 0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="pt-6">
                 <GradientButton
              fullWidth
              className="py-3 text-lg"
             onClick={() => {
               toast.success('Amount submitted successfully');
           handleAction('APPROVE');
              }}
                >
    Submit Final Amount
  </GradientButton>
</div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Override Reason</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-purple h-[46px] resize-none"
                      placeholder="Reason for override..."
                    />
                  </div>
                </div>
              </GlassCard>
            )}
          </div>

          <div className="space-y-8">
            {/* Action Panel */}
            <div className="sticky top-8 space-y-8">
              <GlassCard className="p-8 space-y-6 border-t-4 border-t-accent-purple">
                <h3 className="text-xl font-bold text-white font-space">Action Panel</h3>
                
                {user?.role === 'SCRUTINY_OFFICER' && (
                  <div className="space-y-3">
                    <GradientButton variant="success" fullWidth className="gap-2" onClick={() => handleAction('APPROVE')}>
                      <Check size={18} /> Approve — Documents Verified
                    </GradientButton>
                    <GradientButton variant="outline" fullWidth className="gap-2 border-accent-amber/30 text-accent-amber hover:bg-accent-amber/5" onClick={() => setShowQueryModal(true)}>
                      <MessageSquare size={18} /> Raise Query
                    </GradientButton>
                    <GradientButton variant="outline" fullWidth className="gap-2 border-accent-red/30 text-accent-red hover:bg-accent-red/5" onClick={() => setShowRejectModal(true)}>
                      <X size={18} /> Reject Claim
                    </GradientButton>
                  </div>
                )}

                {user?.role === 'MEDICAL_OFFICER' && (
                  <div className="space-y-3">
                    <GradientButton variant="success" fullWidth className="gap-2" onClick={() => handleAction('APPROVE')}>
                      <Check size={18} /> Approve — Treatment Valid
                    </GradientButton>
                    <GradientButton variant="outline" fullWidth className="gap-2 border-accent-amber/30 text-accent-amber hover:bg-accent-amber/5" onClick={() => setShowQueryModal(true)}>
                      <MessageSquare size={18} /> Raise Query
                    </GradientButton>
                    <GradientButton variant="outline" fullWidth className="gap-2 border-accent-red/30 text-accent-red hover:bg-accent-red/5" onClick={() => setShowRejectModal(true)}>
                      <X size={18} /> Reject Claim
                    </GradientButton>
                  </div>
                )}

                {user?.role === 'FINANCE_OFFICER' && (
                  <div className="space-y-3">
                    <GradientButton variant="success" fullWidth className="gap-2" onClick={() => handleAction('APPROVE')}>
                      <IndianRupee size={18} /> Approve with Calculated Amount
                    </GradientButton>
                    <GradientButton variant="outline" fullWidth className="gap-2 border-accent-amber/30 text-accent-amber hover:bg-accent-amber/5" onClick={() => setShowQueryModal(true)}>
                      <MessageSquare size={18} /> Raise Query
                    </GradientButton>
                    <GradientButton variant="outline" fullWidth className="gap-2 border-accent-red/30 text-accent-red hover:bg-accent-red/5" onClick={() =>setShowRejectModal(true)}>
                      <X size={18} /> Reject Claim
                    </GradientButton>
                  </div>
                )}

                {user?.role === 'DDO' && (
                  <div className="space-y-6">
                    <div className="p-4 bg-accent-violet/10 border border-accent-violet/20 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Amount to be disbursed</p>
                      <p className="text-2xl font-bold text-accent-violet font-space">{formatCurrency(claim.eligible_reimbursement_amount || 0)}</p>
                    </div>

                    {/* Hide action buttons once claim is sanctioned or payment processed */}
                    {claim.claim_status === 'DDO_SANCTIONED' || claim.claim_status === 'PAYMENT_PROCESSED' ? (
                      <div className="p-6 bg-accent-green/10 border border-accent-green/20 rounded-2xl text-center space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-full bg-accent-green/20 flex items-center justify-center">
                          <Check size={32} className="text-accent-green" />
                        </div>
                        <h4 className="text-lg font-bold text-accent-green font-space">
                          {claim.claim_status === 'PAYMENT_PROCESSED' ? 'Payment Processed' : 'Claim Sanctioned'}
                        </h4>
                        <p className="text-xs text-text-muted">
                          {claim.claim_status === 'PAYMENT_PROCESSED'
                            ? 'This claim has been fully processed and payment has been initiated via PFMS.'
                            : 'This claim has been sanctioned. Payment processing is underway.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {!showSanctionConfirm ? (
                          <div className="space-y-2">
                            <GradientButton variant="outline" fullWidth className="gap-2 border-accent-amber/30 text-accent-amber hover:bg-accent-amber/5" onClick={() => setShowQueryModal(true)}>
                              <MessageSquare size={18} /> Raise Query
                            </GradientButton>
                            <GradientButton
                              variant="outline"
                              fullWidth
                              className="gap-2 border-accent-red/30 text-accent-red hover:bg-accent-red/5"
                              onClick={() => setShowRejectModal(true)}
                            >
                              <X size={18} /> Reject Claim
                            </GradientButton>
                            <GradientButton 
                              fullWidth 
                              className="py-4 text-lg bg-linear-to-br from-accent-violet to-accent-purple"
                              onClick={() => setShowSanctionConfirm(true)}
                            >
                              <Stamp className="mr-2" size={24} /> Grant Final Sanction
                            </GradientButton>
                          </div>
                        ) : (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4"
                          >
                            <p className="text-sm text-text-primary text-center">
                              Confirm sanctioning <span className="font-bold text-accent-violet">{formatCurrency(claim.eligible_reimbursement_amount || 0)}</span> for claim {claim.claim_number}? This will trigger PFMS payment.
                            </p>
                            <div className="flex gap-3">
                              <GradientButton variant="outline" fullWidth onClick={() => setShowSanctionConfirm(false)}>Cancel</GradientButton>
                              <GradientButton variant="success" fullWidth onClick={() => handleAction('APPROVE')}>Confirm</GradientButton>
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </GlassCard>

              {/* Workflow History */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest px-2">Workflow History</h3>
                <div className="space-y-0 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-white/5">
                  {workflowHistory.map((log, i) => (
                    <div key={i} className="flex items-start gap-6 py-3 relative">
                      <div className="w-6 h-6 rounded-full border-4 border-primary-bg z-10 bg-accent-green flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {getWorkflowStatusLabel(log.stage_id, log.remarks)}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {String(log.action_by).slice(0, 8).toUpperCase()} • {safeDate(log.created_at) ? format(new Date(log.created_at), 'MMM dd, p') : '-'}
                        </p>
                        {log.remarks && (
                          <p className="text-[10px] text-text-secondary mt-1">{log.remarks}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {workflowHistory.length === 0 && (
                    <div className="py-3 px-2 text-[11px] text-text-muted">No workflow history available yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary-bg/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-32 h-32 rounded-full bg-accent-green/20 flex items-center justify-center mb-6"
            >
              <motion.svg
                viewBox="0 0 52 52"
                className="w-20 h-20 text-accent-green"
                initial="hidden"
                animate="visible"
              >
                <motion.circle
                  cx="26"
                  cy="26"
                  r="25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  variants={{
                    hidden: { pathLength: 0 },
                    visible: { pathLength: 1, transition: { duration: 0.5 } }
                  }}
                />
                <motion.path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  d="M14 27l7 7 16-16"
                  variants={{
                    hidden: { pathLength: 0 },
                    visible: { pathLength: 1, transition: { delay: 0.5, duration: 0.3 } }
                  }}
                />
              </motion.svg>
            </motion.div>
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-2xl font-bold text-white font-space text-center"
            >
              {/* Claim {claim.claim_number} approved<br />and forwarded! */}
              {actionType === 'APPROVE' && `Claim ${claim.claim_number} approved and forwarded!`}
              {actionType === 'QUERY' && `Query raised for claim ${claim.claim_number}`}
              {actionType === 'REJECT' && `Claim ${claim.claim_number} rejected`}     
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>
      {showRejectModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-primary-bg border border-white/10 rounded-2xl p-6 w-[400px] space-y-4">
      
      <h3 className="text-lg font-bold text-white">Reject Claim</h3>

      <textarea
        placeholder="Enter reason for rejection..."
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-text-primary focus:outline-none focus:border-accent-red"
      />

      <div className="flex gap-3">
        <button
          onClick={() => setShowRejectModal(false)}
          className="flex-1 py-2 rounded-xl border border-white/10 text-text-secondary hover:bg-white/5"
        >
          Cancel
        </button>

        <button
          onClick={() => {
            if (!rejectReason.trim()) {
             toast.error("Please enter a reason");
              return;
            }
            setShowRejectModal(false);
            handleAction('REJECT');
          }}
          className="flex-1 py-2 rounded-xl bg-accent-red text-white font-bold hover:opacity-90"
        >
          Confirm Reject
        </button>
      </div>

    </div>
  </div>
)}
{/* ✅ Query Modal */}
{showQueryModal && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-primary-bg border border-white/10 rounded-2xl p-6 w-[400px] space-y-4">
      
      <h3 className="text-lg font-bold text-white">Raise Query</h3>

      <textarea
        placeholder="Enter reason for query..."
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-text-primary focus:outline-none focus:border-accent-amber"
      />

      <div className="flex gap-3">
        <button
          onClick={() => setShowQueryModal(false)}
          className="flex-1 py-2 rounded-xl border border-white/10 text-text-secondary hover:bg-white/5"
        >
          Cancel
        </button>

        <button
          onClick={() => {
            if (!queryText.trim()) {
              toast.error("Please enter a query");
              return;
            }
            setShowQueryModal(false);
            handleAction('QUERY');
          }}
          className="flex-1 py-2 rounded-xl bg-accent-amber text-black font-bold hover:opacity-90"
        >
          Submit Query
        </button>
      </div>

    </div>
  </div>
)}
    </PageTransition>
  );
};