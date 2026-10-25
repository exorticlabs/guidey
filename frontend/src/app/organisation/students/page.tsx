"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";

type Student = {
  id: string;
  name: string;
  email: string;
  progress: number;
  status: string;
  group_ids: number[];
};

type Group = {
  id: number;
  key: string;
  value: string;
};

export default function StudentsDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState<{show: boolean, student: Student | null}>({show: false, student: null});
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, groupsRes] = await Promise.all([
        fetchWithAuth("/api/org/students"),
        fetchWithAuth("/api/org/groups")
      ]);
      const studentsData = await studentsRes.json();
      const groupsData = await groupsRes.json();
      
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await fetchWithAuth(`/api/org/students/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      loadData();
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const handleGroupToggle = (gid: number) => {
    setSelectedGroups(prev => prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]);
  };

  const submitTransfer = async () => {
    if (!showTransferModal.student) return;
    try {
      await fetchWithAuth(`/api/org/students/${showTransferModal.student.id}/transfer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_ids: selectedGroups })
      });
      setShowTransferModal({show: false, student: null});
      loadData();
    } catch (e) {
      alert("Failed to transfer student");
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (!csvFile) return;
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV is empty or missing headers");
      
      const headers = lines[0].toLowerCase().split(',').map(s => s.trim());
      const nameIdx = headers.indexOf('name');
      const emailIdx = headers.indexOf('email');
      
      if (nameIdx === -1 || emailIdx === -1) {
        alert("CSV must contain 'name' and 'email' columns");
        return;
      }

      const uploadPayload = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(s => s.trim());
        if (row[nameIdx] && row[emailIdx]) {
          uploadPayload.push({
            name: row[nameIdx],
            email: row[emailIdx],
            group_ids: selectedGroups
          });
        }
      }

      const res = await fetchWithAuth("/api/org/students/bulk", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: uploadPayload })
      });
      const resData = await res.json();

      if (resData.errors && resData.errors.length > 0) {
        alert(`Created ${resData.created} students.\nErrors:\n${resData.errors.join('\n')}`);
      } else {
        alert(`Successfully created ${resData.created} students.`);
      }

      if (resData.created_credentials && resData.created_credentials.length > 0) {
        const csvRows = ["Name,Email,Password"];
        for (const cred of resData.created_credentials) {
            csvRows.push(`${cred.name},${cred.email},${cred.password}`);
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'student_credentials.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setShowUploadModal(false);
      setCsvFile(null);
      loadData();

    } catch (e) {
      alert("Error processing CSV");
    }
  };

  const getGroupNames = (gids: number[]) => {
    if (!gids || gids.length === 0) return "Unassigned";
    return gids.map(id => groups.find(g => g.id === id)?.value).filter(Boolean).join(", ");
  };

  if (loading) return <div className="p-8 text-on-surface-variant">Loading students...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="font-display-lg text-2xl sm:text-3xl lg:text-4xl text-primary font-bold mb-1">
            Student Management
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manage your student lifecycle, transfer between groups, and perform bulk enrollments.
          </p>
        </div>
        <button 
          onClick={() => { setSelectedGroups([]); setCsvFile(null); setShowUploadModal(true); }}
          className="bg-secondary text-on-secondary px-6 py-2 rounded-lg font-label-md hover:bg-secondary/90 transition-colors flex items-center gap-2 shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">upload</span>
          Bulk Import CSV
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              <th className="p-4 font-label-lg text-on-surface-variant">Name</th>
              <th className="p-4 font-label-lg text-on-surface-variant">Email</th>
              <th className="p-4 font-label-lg text-on-surface-variant">Groups</th>
              <th className="p-4 font-label-lg text-on-surface-variant">Progress</th>
              <th className="p-4 font-label-lg text-on-surface-variant">Status</th>
              <th className="p-4 font-label-lg text-on-surface-variant text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-on-surface-variant italic">
                  No students found.
                </td>
              </tr>
            ) : (
              students.map(s => (
                <tr key={s.id} className="border-b border-outline-variant/50 hover:bg-surface-container-low/50 transition-colors">
                  <td className="p-4 font-body-md font-medium text-on-surface">{s.name}</td>
                  <td className="p-4 font-body-md text-on-surface-variant">{s.email}</td>
                  <td className="p-4 font-body-sm text-on-surface-variant">
                    {getGroupNames(s.group_ids)}
                  </td>
                  <td className="p-4 font-body-md">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="h-full bg-secondary" style={{ width: `${s.progress}%` }}></div>
                      </div>
                      <span className="text-xs text-on-surface-variant">{Math.round(s.progress)}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${s.status === 'active' ? 'bg-primary/10 text-primary' : s.status === 'deactivated' ? 'bg-error/10 text-error' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <select 
                      className="bg-surface-container border border-outline-variant text-sm rounded px-2 py-1 text-on-surface focus:outline-none"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "transfer") {
                          setSelectedGroups(s.group_ids || []);
                          setShowTransferModal({show: true, student: s});
                        } else if (val === "active" || val === "deactivated" || val === "archived") {
                          handleStatusChange(s.id, val);
                        }
                        e.target.value = "";
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Actions...</option>
                      <option value="transfer">Edit Groups</option>
                      <option disabled>───</option>
                      {s.status !== 'active' && <option value="active">Set Active</option>}
                      {s.status !== 'deactivated' && <option value="deactivated">Deactivate</option>}
                      {s.status !== 'archived' && <option value="archived">Archive</option>}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-xxl shadow-xl border border-outline-variant">
            <h2 className="text-xl font-bold text-on-surface mb-2">Bulk Import Students</h2>
            <p className="text-sm text-on-surface-variant mb-6">Upload a CSV file with "name" and "email" columns. Passwords will be auto-generated to `Welcome123!`.</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-on-surface mb-1">CSV File</label>
              <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} className="w-full text-sm border border-outline-variant rounded p-2" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-on-surface mb-1">Assign to Groups (Optional)</label>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {groups.length === 0 ? (
                  <p className="text-sm italic text-on-surface-variant">No groups available.</p>
                ) : (
                  groups.map(g => (
                    <label key={g.id} className="flex items-center gap-3 p-1 hover:bg-surface-container rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedGroups.includes(g.id)}
                        onChange={() => handleGroupToggle(g.id)}
                        className="w-4 h-4 text-secondary rounded focus:ring-secondary"
                      />
                      <span className="text-xs font-bold text-outline uppercase mr-2">{g.key}</span>
                      <span className="text-sm text-on-surface">{g.value}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg">Cancel</button>
              <button onClick={handleBulkUploadSubmit} disabled={!csvFile} className="px-4 py-2 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary/90 disabled:opacity-50">Upload & Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-xxl shadow-xl border border-outline-variant">
            <h2 className="text-xl font-bold text-on-surface mb-2">Edit Groups</h2>
            <p className="text-sm text-on-surface-variant mb-6">Select the groups for {showTransferModal.student?.name}</p>

            <div className="mb-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-3 p-1 hover:bg-surface-container rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedGroups.includes(g.id)}
                      onChange={() => handleGroupToggle(g.id)}
                      className="w-4 h-4 text-secondary rounded focus:ring-secondary"
                    />
                    <span className="text-xs font-bold text-outline uppercase mr-2">{g.key}</span>
                    <span className="text-sm text-on-surface">{g.value}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
              <button onClick={() => setShowTransferModal({show: false, student: null})} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg">Cancel</button>
              <button onClick={submitTransfer} className="px-4 py-2 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary/90">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
