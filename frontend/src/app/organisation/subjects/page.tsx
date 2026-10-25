"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";
import Link from "next/link";

type OrgGroup = {
  id: number;
  parent_id: number | null;
  key: string;
  value: string;
};

type Subject = {
  id: number;
  code: string;
  name: string;
  tag: string;
  syllabus_content: string | null;
  syllabus_url: string | null;
  group_ids: number[];
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subject | null>(null);
  
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    tag: "",
    syllabus_content: "",
    syllabus_url: "",
    group_ids: [] as number[]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, groupRes] = await Promise.all([
        fetchWithAuth("/api/org/subjects"),
        fetchWithAuth("/api/org/groups")
      ]);
      
      if (subRes.ok) setSubjects(await subRes.json());
      if (groupRes.ok) setGroups(await groupRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (sub?: Subject) => {
    if (sub) {
      setEditingSub(sub);
      setFormData({
        code: sub.code,
        name: sub.name,
        tag: sub.tag,
        syllabus_content: sub.syllabus_content || "",
        syllabus_url: sub.syllabus_url || "",
        group_ids: sub.group_ids || []
      });
    } else {
      setEditingSub(null);
      setFormData({
        code: "",
        name: "",
        tag: "",
        syllabus_content: "",
        syllabus_url: "",
        group_ids: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSub(null);
  };

  const handleGroupToggle = (groupId: number) => {
    setFormData(prev => {
      if (prev.group_ids.includes(groupId)) {
        return { ...prev, group_ids: prev.group_ids.filter(id => id !== groupId) };
      } else {
        return { ...prev, group_ids: [...prev.group_ids, groupId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSub) {
        await fetchWithAuth(`/api/org/subjects/${editingSub.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
      } else {
        await fetchWithAuth("/api/org/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
      }
      handleCloseModal();
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    try {
      await fetchWithAuth(`/api/org/subjects/${id}`, { method: "DELETE" });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV is empty or missing headers");
      
      const headers = lines[0].toLowerCase().split(',').map(s => s.trim());
      const codeIdx = headers.indexOf('code');
      const nameIdx = headers.indexOf('name');
      const tagIdx = headers.indexOf('tag');
      const urlIdx = headers.indexOf('syllabus_url');
      
      const subjects = [];
      for (let i = 1; i < lines.length; i++) {
        // Simple CSV parse (doesn't handle commas inside quotes, but good enough for basic use)
        const row = lines[i].split(',').map(s => s.trim());
        if (codeIdx !== -1 && nameIdx !== -1 && tagIdx !== -1 && row[codeIdx] && row[nameIdx] && row[tagIdx]) {
          subjects.push({
            code: row[codeIdx],
            name: row[nameIdx],
            tag: row[tagIdx],
            syllabus_url: urlIdx !== -1 ? (row[urlIdx] || null) : null
          });
        }
      }

      if (subjects.length > 0) {
        await fetchWithAuth("/api/org/subjects/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjects })
        });
        alert(`Successfully processed ${subjects.length} subjects.`);
        loadData();
      } else {
        alert("No valid subjects found. Ensure columns include: code, name, tag");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing CSV file.");
    }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-on-surface-variant">Loading subjects...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="font-display-lg text-2xl sm:text-3xl lg:text-4xl text-primary font-bold mb-1">
            Subject & Syllabus Management
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manage your academic subjects, upload syllabus content, and map them to specific groups in your academic structure.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <label className="bg-surface-container border border-outline-variant text-on-surface px-6 py-2 rounded-lg font-label-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm flex-1 md:flex-none">
            <span className="material-symbols-outlined text-[20px]">upload</span>
            Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
          </label>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-secondary text-on-secondary px-6 py-2 rounded-lg font-label-md hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2 shadow-sm flex-1 md:flex-none"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Subject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(sub => (
          <div key={sub.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-secondary uppercase tracking-wider mb-1 block">{sub.tag}</span>
                <h3 className="font-headline-sm text-headline-sm text-primary">
                  {sub.code}: {sub.name}
                </h3>
              </div>
            </div>
            
            <div className="mb-4">
              <span className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-2 block">Assigned Groups</span>
              <div className="flex flex-wrap gap-2">
                {sub.group_ids.map(gid => {
                  const g = groups.find(x => x.id === gid);
                  return g ? (
                    <span key={gid} className="bg-surface-container-high text-xs px-2 py-1 rounded-full text-on-surface">
                      {g.key}: {g.value}
                    </span>
                  ) : null;
                })}
                {sub.group_ids.length === 0 && <span className="text-xs text-on-surface-variant italic">Unassigned</span>}
              </div>
            </div>

            <div className="mb-6">
              <span className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-2 block">Syllabus</span>
              <div className="flex gap-4">
                {sub.syllabus_content ? (
                  <span className="flex items-center gap-1 text-xs text-secondary bg-secondary/10 px-2 py-1 rounded">
                    <span className="material-symbols-outlined text-[14px]">description</span> Content Added
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-outline-variant">
                    <span className="material-symbols-outlined text-[14px]">description</span> No Content
                  </span>
                )}
                
                {sub.syllabus_url ? (
                  <a href={sub.syllabus_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-tertiary bg-tertiary/10 px-2 py-1 rounded hover:underline">
                    <span className="material-symbols-outlined text-[14px]">link</span> External URL
                  </a>
                ) : null}
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/50 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Link href={`/organisation/subjects/${sub.id}`} className="text-secondary font-label-sm flex items-center gap-1 hover:underline mr-auto">
                View Graph / Details
              </Link>
              <button onClick={() => handleOpenModal(sub)} className="text-primary font-label-sm flex items-center gap-1 hover:underline">
                Edit
              </button>
              <button onClick={() => handleDelete(sub.id)} className="text-error font-label-sm flex items-center gap-1 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
        {subjects.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-outline-variant rounded-2xl">
            <span className="material-symbols-outlined text-5xl text-outline mb-3 block">menu_book</span>
            <p className="font-body-lg text-on-surface-variant mb-4">No subjects found. Add one to get started.</p>
            <button 
              onClick={() => handleOpenModal()}
              className="text-secondary font-medium hover:underline"
            >
              + Create First Subject
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-full max-w-2xl shrink-0 rounded-2xl p-8 shadow-xl border border-outline-variant max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-primary">{editingSub ? "Edit Subject" : "New Subject"}</h2>
              <button onClick={handleCloseModal} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Subject Code</label>
                  <input 
                    type="text" required placeholder="e.g. CS101"
                    value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})}
                    className="w-full px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Subject Name</label>
                  <input 
                    type="text" required placeholder="e.g. Intro to Computer Science"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1">Tag (Category)</label>
                <input 
                  type="text" placeholder="e.g. Core, Elective, Mathematics"
                  value={formData.tag} onChange={e => setFormData({...formData, tag: e.target.value})}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div className="border-t border-outline-variant pt-6">
                <h3 className="text-lg font-bold text-on-surface mb-4">Syllabus Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1">Syllabus URL (External Link)</label>
                    <input 
                      type="url" placeholder="https://example.com/syllabus.pdf"
                      value={formData.syllabus_url} onChange={e => setFormData({...formData, syllabus_url: e.target.value})}
                      className="w-full px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1">Syllabus Content (Markdown)</label>
                    <textarea 
                      rows={6} placeholder="# Unit 1: Introduction..."
                      value={formData.syllabus_content} onChange={e => setFormData({...formData, syllabus_content: e.target.value})}
                      className="w-full px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-outline-variant pt-6">
                <h3 className="text-lg font-bold text-on-surface mb-4">Assign to Groups</h3>
                <p className="text-sm text-on-surface-variant mb-4">Select the academic groups that should have access to this subject.</p>
                
                <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                  {groups.length === 0 ? (
                    <p className="text-sm italic text-on-surface-variant">No groups defined in the academic structure yet.</p>
                  ) : (
                    groups.map(g => (
                      <label key={g.id} className="flex items-center gap-3 p-2 hover:bg-surface-container rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={formData.group_ids.includes(g.id)}
                          onChange={() => handleGroupToggle(g.id)}
                          className="w-4 h-4 text-secondary rounded border-outline-variant focus:ring-secondary"
                        />
                        <div>
                          <span className="text-xs font-bold text-outline uppercase mr-2">{g.key}</span>
                          <span className="text-sm font-medium text-on-surface">{g.value}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-outline-variant">
                <button type="button" onClick={handleCloseModal} className="px-6 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary/90 transition-colors">
                  {editingSub ? "Save Changes" : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
