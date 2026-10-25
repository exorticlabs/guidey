"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/utils/api";

type Organization = {
  id: number;
  name: string;
  current_semester: string;
  active_students: number;
  is_subscribed: boolean;
  usage_limit: number;
};

export default function ManageOrganizations() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    current_semester: "Fall 2026",
    teaching_style: "Friendly",
    is_subscribed: false,
    usage_limit: 1000,
    admin_email: "",
    admin_password: ""
  });

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/orgs");
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const handleOpenModal = (org?: Organization) => {
    if (org) {
      setEditingOrg(org);
      setFormData({
        name: org.name,
        current_semester: org.current_semester,
        teaching_style: "Friendly", // not fetched by default but ok
        is_subscribed: org.is_subscribed,
        usage_limit: org.usage_limit,
        admin_email: "",
        admin_password: ""
      });
    } else {
      setEditingOrg(null);
      setFormData({
        name: "",
        current_semester: "Fall 2026",
        teaching_style: "Friendly",
        is_subscribed: false,
        usage_limit: 1000,
        admin_email: "",
        admin_password: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOrg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOrg) {
        // Update
        const res = await fetchWithAuth(`/api/admin/orgs/${editingOrg.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        if (res.ok) loadOrgs();
      } else {
        // Create
        const res = await fetchWithAuth("/api/admin/orgs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        if (res.ok) loadOrgs();
      }
      handleCloseModal();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this organization?")) return;
    try {
      const res = await fetchWithAuth(`/api/admin/orgs/${id}`, {
        method: "DELETE"
      });
      if (res.ok) loadOrgs();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8 text-on-surface-variant">Loading organizations...</div>;

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
        <h3 className="text-lg font-medium text-on-surface">Manage Organizations</h3>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + Add Organization
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest border-b border-outline-variant text-sm text-on-surface-variant">
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Semester</th>
              <th className="p-4 font-medium">Active Students</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Usage Limit</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-surface-container-lowest transition-colors">
                <td className="p-4 text-on-surface-variant">{org.id}</td>
                <td className="p-4 font-medium text-on-surface">{org.name}</td>
                <td className="p-4 text-on-surface-variant">{org.current_semester}</td>
                <td className="p-4 text-on-surface-variant">{org.active_students}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${org.is_subscribed ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                    {org.is_subscribed ? 'Subscribed' : 'Trial'}
                  </span>
                </td>
                <td className="p-4 text-on-surface-variant">{org.usage_limit}</td>
                <td className="p-4 flex gap-3">
                  <button onClick={() => handleOpenModal(org)} className="text-primary hover:underline text-sm">Edit</button>
                  <button onClick={() => handleDelete(org.id)} className="text-error hover:underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                  No organizations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-surface w-full max-w-xxl shrink-0 rounded-2xl p-6 shadow-xl border border-outline-variant max-h-[90vh] overflow-y-auto my-auto">
            <h2 className="text-xl font-bold text-primary mb-4">{editingOrg ? "Edit Organization" : "New Organization"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Name</label>
                <input 
                  type="text" required
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Current Semester</label>
                <input 
                  type="text" required
                  value={formData.current_semester} onChange={e => setFormData({...formData, current_semester: e.target.value})}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Teaching Style</label>
                <input 
                  type="text" required
                  value={formData.teaching_style} onChange={e => setFormData({...formData, teaching_style: e.target.value})}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Usage Limit (Tokens/Messages)</label>
                <input 
                  type="number" required min="0"
                  value={formData.usage_limit} onChange={e => setFormData({...formData, usage_limit: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input 
                  type="checkbox" id="is_subscribed"
                  checked={formData.is_subscribed} onChange={e => setFormData({...formData, is_subscribed: e.target.checked})}
                  className="rounded border-outline-variant text-primary"
                />
                <label htmlFor="is_subscribed" className="text-sm font-medium text-on-surface">Is Subscribed (Premium)</label>
              </div>

              {!editingOrg && (
                <div className="mt-6 pt-4 border-t border-outline-variant space-y-4">
                  <h3 className="text-sm font-bold text-primary">Organization Root Admin Credentials</h3>
                  <p className="text-xs text-on-surface-variant">Provide credentials for the principal/admin of this organization.</p>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1">Admin Email</label>
                    <input 
                      type="email" required
                      value={formData.admin_email} onChange={e => setFormData({...formData, admin_email: e.target.value})}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                      placeholder="admin@college.edu"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1">Admin Password</label>
                    <input 
                      type="password" required minLength={6}
                      value={formData.admin_password} onChange={e => setFormData({...formData, admin_password: e.target.value})}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}
              
              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant mt-6">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                  {editingOrg ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
