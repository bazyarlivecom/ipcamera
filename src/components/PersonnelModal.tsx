import React, { useState } from 'react';
import {
  X,
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  Building,
  BadgeAlert,
  Search,
} from 'lucide-react';
import { RegisteredPerson } from '../types';

interface PersonnelModalProps {
  persons: RegisteredPerson[];
  onAddPerson: (person: Partial<RegisteredPerson>) => void;
  onDeletePerson: (id: string) => void;
  onClose: () => void;
}

export const PersonnelModal: React.FC<PersonnelModalProps> = ({
  persons,
  onAddPerson,
  onDeletePerson,
  onClose,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [fullName, setFullName] = useState('');
  const [personnelCode, setPersonnelCode] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [accessLevel, setAccessLevel] = useState<RegisteredPerson['accessLevel']>('authorized');
  const [photoUrl, setPhotoUrl] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    onAddPerson({
      fullName,
      personnelCode: personnelCode || `EMP-${Math.floor(Math.random() * 9000 + 1000)}`,
      role: role || 'کارشناس',
      department: department || 'دفتر مرکزی',
      accessLevel,
      photoUrl:
        photoUrl ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
    });

    setFullName('');
    setPersonnelCode('');
    setRole('');
    setDepartment('');
    setPhotoUrl('');
    setShowAddForm(false);
  };

  const filteredPersons = persons.filter(
    (p) =>
      p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.personnelCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                بانک اطلاعات چهره‌های مجاز و پرسنل (AUTHORIZED FACES DB)
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                BIOMETRIC IDENTITY VAULT FOR REAL-TIME MATCHING
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          {/* Top action row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجو در لیست پرسنل..."
                className="w-full pl-3 pr-8 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'انصراف' : 'ثبت شخص جدید'}</span>
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <form
              onSubmit={handleAdd}
              className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                مشخصات پرسنل جهت تشخیص چهره (BIOMETRIC REGISTRATION)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">نام و نام خانوادگی (NAME):</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثلاً: دکتر علیرضا محمدی"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">کد پرسنلی (ID):</label>
                  <input
                    type="text"
                    value={personnelCode}
                    onChange={(e) => setPersonnelCode(e.target.value)}
                    placeholder="مثلاً: EMP-1044"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">سمت / شغل (TITLE):</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="مثلاً: مدیر ارشد شبکه"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-mono">واحد سازمانی (UNIT):</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="مثلاً: فناوری اطلاعات"
                    className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1 font-mono">آدرس عکس چهره پرسنل (PHOTO URL):</label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://... یا خالی بگذارید برای آواتار خودکار"
                  className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-md bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold uppercase tracking-wider shadow-sm"
                >
                  افزودن به بانک چهره‌ها
                </button>
              </div>
            </form>
          )}

          {/* Persons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredPersons.map((p) => (
              <div
                key={p.id}
                className="p-2.5 rounded-md bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-700 flex-shrink-0 bg-slate-800">
                    <img
                      src={
                        p.photoUrl ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
                      }
                      alt={p.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{p.fullName}</h4>
                    <div className="text-[11px] font-mono text-cyan-400">{p.personnelCode}</div>
                    <div className="text-[10px] text-slate-400">
                      {p.role} • {p.department}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    AUTHORIZED
                  </span>
                  <button
                    onClick={() => onDeletePerson(p.id)}
                    className="p-1 rounded-md hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                    title="حذف از لیست"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
