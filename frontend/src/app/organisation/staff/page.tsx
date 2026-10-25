"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";

export default function StaffPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("teacher");
  const [deptId, setDeptId] = useState("");
  const [designation, setDesignation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [staffRes, deptRes] = await Promise.all([
        fetchWithAuth("/api/org/staff"),
        fetchWithAuth("/api/org/departments")
      ]);
      if (staffRes.ok) setStaffList(await staffRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/org/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          department_id: deptId ? parseInt(deptId) : null,
          designation
        })
      });
      if (res.ok) {
        setShowForm(false);
        setName("");
        setEmail("");
        setDesignation("");
        loadData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4 mb-lg">
        <div>
          <h1 className="font-display-lg text-2xl sm:text-3xl lg:text-4xl text-primary font-bold mb-1">
            Staff Management
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manage teachers, admins, and support staff.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-on-primary px-6 py-2 rounded-full font-label-md hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">
            {showForm ? 'close' : 'person_add'}
          </span>
          {showForm ? 'Cancel' : 'Add Staff'}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-lg animate-in slide-in-from-top-4 duration-300">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-md">New Staff Member</h2>
          <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-2">Full Name</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-primary focus:outline-none focus:border-secondary" />
            </div>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-2">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-primary focus:outline-none focus:border-secondary" />
            </div>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-2">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-primary focus:outline-none focus:border-secondary">
                <option value="teacher">Teacher</option>
                <option value="clg">College Admin</option>
                <option value="admin">System Admin</option>
              </select>
            </div>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-2">Department</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-primary focus:outline-none focus:border-secondary">
                <option value="">None</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end mt-4">
              <button disabled={isSubmitting} type="submit" className="bg-secondary text-on-secondary px-8 py-2 rounded-lg font-label-md hover:bg-secondary/90 disabled:opacity-50 transition-colors">
                {isSubmitting ? 'Saving...' : 'Save Staff Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold">
                        {staff.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-body-md text-primary font-medium">{staff.name}</div>
                        <div className="font-label-sm text-on-surface-variant">{staff.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full font-label-sm capitalize">
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-body-md text-on-surface-variant">
                    {staff.department || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-tertiary-container font-label-sm">
                      <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span> Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-outline hover:text-primary transition-colors p-2">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button className="text-outline hover:text-error transition-colors p-2">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {staffList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                    No staff members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
