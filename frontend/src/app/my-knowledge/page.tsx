"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";

// --- Types ---
interface AssessmentTopic {
  id: string;
  name: string;
  subject_name: string;
  status: string;
  mastery_level: number;
  is_weak: boolean;
}

interface Question {
  id: string;
  type: string;
  question: string;
  options: string[];
}

interface AssessmentHistory {
  topic_id: string;
  topic_name: string;
  score: number;
  updated_mastery: number;
  timestamp: string;
}

interface Mistake {
  topic_id: string;
  topic_name: string;
  misconception: string;
  question_context: string[];
}

export default function MyKnowledgePage() {
  const { user } = useAuth();

  // Tabs: "mastery", "assessments", "history"
  const [activeTab, setActiveTab] = useState<"mastery" | "assessments" | "history">("mastery");
  const [loading, setLoading] = useState(true);

  // Mastery State
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [weaknesses, setWeaknesses] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>(null);

  // Assessment State
  const [topics, setTopics] = useState<AssessmentTopic[]>([]);
  const [history, setHistory] = useState<AssessmentHistory[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);

  // Quiz Engine State
  const [activeQuiz, setActiveQuiz] = useState<Question[] | null>(null);
  const [currentTopic, setCurrentTopic] = useState<{ id: string, name: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [heatRes, weakRes, graphRes, topicsRes, historyRes] = await Promise.all([
        fetchWithAuth("/api/mastery/heatmap"),
        fetchWithAuth("/api/mastery/weaknesses"),
        fetchWithAuth("/api/mastery/graph"),
        fetchWithAuth("/api/assessments/topics"),
        fetchWithAuth("/api/assessments/history")
      ]);

      if (heatRes.ok) setHeatmapData(await heatRes.json());
      if (weakRes.ok) setWeaknesses(await weakRes.json());
      if (graphRes.ok) setGraphData(await graphRes.json());

      const topicsData = topicsRes.ok ? await topicsRes.json() : [];
      const historyData = historyRes.ok ? await historyRes.json() : { history: [], mistakes: [] };
      setTopics(topicsData);
      setHistory(historyData.history || []);
      setMistakes(historyData.mistakes || []);
    } catch (e) {
      console.error("Failed to load knowledge data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // --- Quiz Handlers ---
  const handleGenerate = async (topicId: string, topicName: string) => {
    setGenerating(true);
    setQuizResult(null);
    setCurrentTopic({ id: topicId, name: topicName });
    try {
      const res = await fetchWithAuth("/api/assessments/generate", {
        method: "POST",
        body: JSON.stringify({ topic_id: topicId, topic_name: topicName })
      });
      const data = await res.json();
      if (data.questions) {
        setActiveQuiz(data.questions);
        setAnswers({});
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate assessment");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectAnswer = (qId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [qId]: option }));
  };

  const handleSubmit = async () => {
    if (!currentTopic || !activeQuiz) return;

    if (Object.keys(answers).length < activeQuiz.length) {
      if (!confirm("You haven't answered all questions. Submit anyway?")) return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/assessments/submit", {
        method: "POST",
        body: JSON.stringify({ topic_id: currentTopic.id, answers })
      });
      const data = await res.json();
      setQuizResult(data);
      setActiveQuiz(null); // Close quiz view
      loadData(); // Refresh history & graphs
    } catch (e) {
      console.error(e);
      alert("Failed to submit assessment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-background text-on-background min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6 py-12 text-center max-w-2xl mx-auto animate-fade-in-up">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 shadow-inner">
          <span className="material-symbols-outlined text-4xl">lock</span>
        </div>
        <h1 className="font-display-lg text-3xl font-bold text-primary mb-3">Adaptive Knowledge Mapping</h1>
        <p className="font-body-md text-sm text-on-surface-variant mb-8 leading-relaxed">
          Unlock your personalized, dynamic knowledge graph. Track concept masteries, identify weak areas, clear misconceptions, and take custom quizzes generated just for you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 bg-primary text-on-primary rounded-full font-bold hover:shadow-lg transition-all text-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            Create Free Account
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-outline text-primary rounded-full font-bold hover:bg-surface-container-low transition-all text-sm active:scale-98"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-24 lg:pb-8 overflow-y-auto">
        <div className="px-container-margin lg:px-8 py-md mt-sm max-w-screen-xl mx-auto space-y-8 animate-fade-in">

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-headline-md text-3xl font-bold text-primary">My Knowledge</h1>
              <p className="font-body-md text-on-surface-variant mt-1">
                Visualize your knowledge graph, track progress, and take adaptive assessments.
              </p>
            </div>
            {/* Tabs */}
            <div className="flex bg-surface-container rounded-full p-1 border border-outline-variant shadow-sm w-fit">
              <button
                onClick={() => setActiveTab("mastery")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === "mastery" ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"
                  }`}
              >
                Graph & Heatmap
              </button>
              <button
                onClick={() => setActiveTab("assessments")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === "assessments" ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"
                  }`}
              >
                Assessments
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === "history" ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"
                  }`}
              >
                History & Misconceptions
              </button>
            </div>
          </header>

          {/* ACTIVE QUIZ VIEW */}
          {activeQuiz && currentTopic && !quizResult && activeTab === "assessments" && (
            <div className="bg-surface-container rounded-3xl p-6 shadow-sm border border-outline-variant animate-fade-in-up">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-primary">Assessment: {currentTopic.name}</h2>
                <button
                  onClick={() => setActiveQuiz(null)}
                  className="text-on-surface-variant hover:text-error transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-8">
                {activeQuiz.map((q, i) => (
                  <div key={q.id} className="bg-surface rounded-2xl p-6 shadow-sm">
                    <p className="font-bold text-primary mb-4 flex gap-2">
                      <span className="text-secondary">{i + 1}.</span> {q.question}
                    </p>
                    <div className="space-y-3">
                      {q.options.map((opt, j) => {
                        const isSelected = answers[q.id] === opt;
                        return (
                          <button
                            key={j}
                            onClick={() => handleSelectAnswer(q.id, opt)}
                            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${isSelected
                                ? "border-secondary bg-secondary/10 text-secondary font-medium shadow-sm"
                                : "border-outline-variant hover:border-outline hover:bg-surface-container-low"
                              }`}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 bg-secondary text-on-primary rounded-full font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? "Evaluating..." : "Submit Assessment"}
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          )}

          {/* QUIZ RESULT VIEW */}
          {quizResult && activeTab === "assessments" && (
            <div className="bg-surface-container rounded-3xl p-6 shadow-sm border border-outline-variant space-y-6 animate-fade-in-up">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-4xl text-secondary">
                    {quizResult.correct_count === quizResult.total_questions ? "emoji_events" : "fact_check"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-primary mb-2">Assessment Complete!</h2>
                <p className="text-on-surface-variant">
                  You scored {quizResult.correct_count} out of {quizResult.total_questions}.
                </p>
                <div className="mt-4 flex items-center justify-center gap-4 text-sm font-medium">
                  <span className="px-3 py-1 bg-surface rounded-full text-on-surface-variant shadow-sm border border-outline-variant">
                    Previous Mastery: {quizResult.previous_mastery.toFixed(1)}%
                  </span>
                  <span className="material-symbols-outlined text-outline">arrow_forward</span>
                  <span className={`px-3 py-1 rounded-full shadow-sm border ${quizResult.new_mastery > quizResult.previous_mastery ? "bg-green-500/20 text-green-700 border-green-500/30" : "bg-orange-500/20 text-orange-700 border-orange-500/30"}`}>
                    New Mastery: {quizResult.new_mastery.toFixed(1)}%
                  </span>
                </div>
                <p className="text-on-surface-variant mt-4 max-w-2xl mx-auto italic">
                  "{quizResult.reasoning}"
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg text-primary">Detailed Feedback</h3>
                {quizResult.results.map((r: any, i: number) => (
                  <div key={i} className={`p-4 rounded-xl border ${r.is_correct ? "border-green-500/30 bg-green-500/5" : "border-error/30 bg-error/5"}`}>
                    <p className="font-medium text-primary mb-2">{i + 1}. {r.question}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-outline">Your Answer:</span>
                        <p className={`font-medium ${r.is_correct ? "text-green-600" : "text-error"}`}>{r.student_answer || "Skipped"}</p>
                      </div>
                      {!r.is_correct && (
                        <div>
                          <span className="text-outline">Correct Answer:</span>
                          <p className="font-medium text-green-600">{r.correct_answer}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-on-surface-variant mt-2 bg-surface p-3 rounded-lg border border-outline-variant shadow-sm">
                      <span className="material-symbols-outlined text-[16px] inline-block align-text-bottom mr-1 text-secondary">lightbulb</span>
                      {r.explanation}
                    </p>
                  </div>
                ))}
              </div>

              {quizResult.misconceptions_found && quizResult.misconceptions_found.length > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl">
                  <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">warning</span>
                    Misconceptions Detected
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-orange-900 dark:text-orange-200">
                    {quizResult.misconceptions_found.map((m: string, i: number) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => { setQuizResult(null); setCurrentTopic(null); }}
                  className="px-6 py-2 bg-surface border border-outline-variant rounded-full text-primary hover:bg-surface-variant transition-colors font-medium shadow-sm"
                >
                  Back to Assessments
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: MASTERY GRAPH & HEATMAP */}
          {activeTab === "mastery" && (
            <div className="animate-fade-in-up space-y-md">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
                {/* Knowledge Graph Card */}
                <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-md flex flex-col hover:shadow-lg transition-shadow duration-300">
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">hub</span>
                    Knowledge Graph
                  </h2>
                  <div className="flex-1 min-h-[400px] w-full bg-surface-container rounded-lg overflow-hidden relative border border-outline-variant">
                    {graphData && <ForceGraph data={graphData} />}
                  </div>
                  <p className="font-label-sm text-on-surface-variant mt-sm text-center">
                    Nodes represent concepts. Size indicates mastery level. Connections show dependencies.
                  </p>
                </div>

                {/* Weaknesses Card */}
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-md flex flex-col hover:shadow-lg transition-shadow duration-300">
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-error">warning</span>
                    Areas to Review
                  </h2>
                  <div className="flex-1 overflow-y-auto space-y-sm pr-2">
                    {weaknesses && weaknesses.length > 0 ? (
                      weaknesses.map((w: any) => (
                        <div key={w.id} className="bg-surface-container border border-outline-variant rounded-lg p-3 hover:-translate-y-0.5 transition-transform duration-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-body-md text-primary font-medium">{w.concept_name}</h3>
                              <p className="font-label-sm text-on-surface-variant">{w.subject_name}</p>
                            </div>
                            {w.needs_practice && (
                              <span className="bg-error/10 text-error text-xs px-2 py-1 rounded-full font-medium border border-error/20">Review</span>
                            )}
                          </div>
                          <Link href={`/tutor?new=1&prompt=${encodeURIComponent(`I need help reviewing ${w.concept_name} for ${w.subject_name}`)}`}
                            className="mt-3 flex items-center justify-center gap-1 w-full bg-secondary/10 text-secondary hover:bg-secondary/20 py-2 rounded-md text-sm font-medium transition-colors border border-secondary/20">
                            Practice Now <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">verified</span>
                        <p>No weaknesses detected! Great job.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Concept Heatmap Section */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-md hover:shadow-lg transition-shadow duration-300">
                <h2 className="font-headline-sm text-headline-sm text-primary mb-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">grid_on</span>
                  Concept Mastery Heatmap
                </h2>
                <div className="overflow-x-auto pb-4">
                  <div className="min-w-[800px]">
                    {heatmapData && heatmapData.map((unit: any) => (
                      <div key={unit.unit_id} className="mb-md">
                        <div className="flex items-center gap-3 mb-xs">
                          <h3 className="font-body-lg font-medium text-primary">{unit.unit_name}</h3>
                          <span className="font-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
                            {unit.subject_name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {unit.topics.map((topic: any) => {
                            let colorClass = "bg-surface-container border-outline-variant";
                            let textColor = "text-on-surface";
                            if (topic.mastery >= 80) {
                              colorClass = "bg-green-500/20 border-green-500/50";
                              textColor = "text-green-700 dark:text-green-400";
                            } else if (topic.mastery >= 50) {
                              colorClass = "bg-yellow-500/20 border-yellow-500/50";
                              textColor = "text-yellow-700 dark:text-yellow-400";
                            } else if (topic.mastery > 0) {
                              colorClass = "bg-red-500/20 border-red-500/50";
                              textColor = "text-red-700 dark:text-red-400";
                            }

                            return (
                              <div
                                key={topic.id}
                                className={`flex flex-col justify-between w-32 h-24 p-2 rounded-lg border shadow-sm transition-transform hover:scale-105 cursor-pointer ${colorClass}`}
                                title={`${topic.name}: ${topic.mastery}% Mastery`}
                                onClick={() => window.location.href = `/tutor?new=1&topic_id=${topic.id}`}
                              >
                                <span className={`font-label-sm leading-tight line-clamp-2 ${textColor}`}>
                                  {topic.name}
                                </span>
                                <div className="flex justify-between items-end mt-1">
                                  <span className={`font-label-lg font-bold ${textColor}`}>
                                    {topic.mastery > 0 ? `${topic.mastery}%` : '-'}
                                  </span>
                                  {topic.mastery >= 80 && (
                                    <span className="material-symbols-outlined text-sm text-green-600 dark:text-green-400">workspace_premium</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-sm pt-sm border-t border-outline-variant text-sm text-on-surface-variant">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500/40 border border-green-500/50"></div> Mastery {'>'} 80%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500/40 border border-yellow-500/50"></div> Mastery 50-80%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/40 border border-red-500/50"></div> Mastery {'<'} 50%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-surface-container border border-outline-variant"></div> Not Started</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ASSESSMENTS */}
          {activeTab === "assessments" && !activeQuiz && !quizResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
              {topics.filter(t => t.status === "active" || t.is_weak).length === 0 ? (
                <div className="col-span-full py-12 text-center text-on-surface-variant bg-surface-container rounded-3xl border border-outline-variant shadow-sm">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">task</span>
                  <p>No active topics require assessment right now.</p>
                </div>
              ) : (
                topics.filter(t => t.status === "active" || t.is_weak).map(t => (
                  <div key={t.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:shadow-lg transition-all group flex flex-col shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-medium px-2 py-1 bg-surface-container rounded-md border border-outline-variant text-on-surface-variant mb-2 inline-block">
                          {t.subject_name}
                        </span>
                        <h3 className="font-bold text-lg text-primary">{t.name}</h3>
                      </div>
                      {t.is_weak && (
                        <span className="material-symbols-outlined text-orange-500" title="Weakness Detected">
                          warning
                        </span>
                      )}
                    </div>

                    <div className="mb-6 flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-outline">Current Mastery</span>
                        <span className="font-medium text-primary">{t.mastery_level.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-surface-container border border-outline-variant rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${t.is_weak ? "bg-orange-500" : "bg-secondary"}`}
                          style={{ width: `${t.mastery_level}%` }}
                        ></div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleGenerate(t.id, t.name)}
                      disabled={generating}
                      className="w-full py-2.5 rounded-xl border border-secondary text-secondary font-medium hover:bg-secondary hover:text-white transition-colors flex justify-center items-center gap-2"
                    >
                      {generating && currentTopic?.id === t.id ? (
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">play_arrow</span>
                      )}
                      Start Adaptive Quiz
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: HISTORY & MISCONCEPTIONS */}
          {activeTab === "history" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
              {/* Misconceptions Panel */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-sm">
                <h3 className="font-display-lg text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500">psychology_alt</span>
                  Misconception Analysis
                </h3>

                {mistakes.length === 0 ? (
                  <p className="text-on-surface-variant italic py-8 text-center bg-surface-container rounded-xl border border-outline-variant">
                    No active misconceptions detected. Great job!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {mistakes.map((m, i) => (
                      <div key={i} className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold px-2 py-1 bg-orange-500/10 text-orange-800 dark:text-orange-300 rounded uppercase tracking-wider border border-orange-500/20">
                            {m.topic_name}
                          </span>
                        </div>
                        <p className="font-medium text-primary mb-2">{m.misconception}</p>
                        {m.question_context && m.question_context.length > 0 && (
                          <div className="mt-3 text-sm">
                            <span className="text-outline">Context from failed question:</span>
                            <p className="text-on-surface-variant italic mt-1 pl-3 border-l-2 border-orange-500/30">
                              "{m.question_context[0]}"
                            </p>
                          </div>
                        )}
                        <div className="mt-4 flex gap-2">
                          <Link href={`/tutor?new=1&prompt=${encodeURIComponent(`Help me clarify a misconception I have about ${m.topic_name}: ${m.misconception}`)}`} className="text-xs px-3 py-1.5 bg-surface text-secondary border border-outline-variant rounded-lg hover:bg-surface-variant transition-colors flex items-center gap-1 shadow-sm">
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                            Discuss with Tutor
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History Panel */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-sm">
                <h3 className="font-display-lg text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">history</span>
                  Recent Assessments
                </h3>

                {history.length === 0 ? (
                  <p className="text-on-surface-variant italic py-8 text-center bg-surface-container rounded-xl border border-outline-variant">
                    No assessments taken yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-surface-container rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
                        <div>
                          <p className="font-bold text-primary">{h.topic_name}</p>
                          <p className="text-xs text-on-surface-variant mt-1">
                            {h.timestamp ? new Date(h.timestamp).toLocaleDateString() : "Recently"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary text-lg">{h.score}%</p>
                          <p className="text-xs text-outline">Score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Fixed ForceGraph with Alpha decay
function ForceGraph({ data }: { data: { nodes: any[], links: any[] } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ w: 800, h: 400 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setDimensions({ w: width, h: height });

    const nodeCount = data.nodes.length;
    const radius = Math.min(width, height) * 0.35;
    const cx = width / 2;
    const cy = height / 2;

    const positionedNodes = data.nodes.map((node, i) => {
      const angle = (i / nodeCount) * 2 * Math.PI;
      const r = radius * (3);
      return {
        ...node,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        vx: 0,
        vy: 0
      };
    });

    setNodes(positionedNodes);
    setLinks(data.links);
  }, [data]);

  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    let currentNodes = [...nodes];
    const { w, h } = dimensions;
    const cx = w / 2;
    const cy = h / 2;

    let alpha = 1.0; // Decay factor

    const tick = () => {
      if (alpha < 0.005) {
        // Stop animation completely when settled
        return;
      }

      let moved = false;

      currentNodes = currentNodes.map((node) => {
        let fx = (cx - node.x) * 0.005;
        let fy = (cy - node.y) * 0.005;

        currentNodes.forEach((other) => {
          if (other.id !== node.id) {
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 90) {
              fx += (dx / dist) * 0.5 * alpha;
              fy += (dy / dist) * 0.5 * alpha;
            }
          }
        });

        links.forEach(link => {
          if (link.source === node.id || link.target === node.id) {
            const otherId = link.source === node.id ? link.target : link.source;
            const other = currentNodes.find(n => n.id === otherId);
            if (other) {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dist > 120) {
                fx += dx * 0.02 * alpha;
                fy += dy * 0.02 * alpha;
              }
            }
          }
        });

        const vx = (node.vx + fx) * 0.6; // High damping
        const vy = (node.vy + fy) * 0.6; // High damping

        if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) moved = true;

        return {
          ...node,
          x: Math.max(30, Math.min(w - 30, node.x + vx)),
          y: Math.max(30, Math.min(h - 30, node.y + vy)),
          vx,
          vy
        };
      });

      setNodes(currentNodes);
      alpha *= 0.95; // Cool down

      if (moved) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [links, dimensions.w, dimensions.h]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: '400px' }}>
      <svg className="w-full h-full absolute inset-0">
        {links.map((link, i) => {
          const sourceNode = nodes.find(n => n.id === link.source);
          const targetNode = nodes.find(n => n.id === link.target);
          if (!sourceNode || !targetNode) return null;

          const isHighlighted = hoveredNode === sourceNode.id || hoveredNode === targetNode.id;

          return (
            <line
              key={i}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke={isHighlighted ? "var(--color-secondary)" : "var(--color-outline-variant)"}
              strokeWidth={isHighlighted ? 2 : 1}
              className="transition-colors duration-300"
            />
          );
        })}

        {nodes.map((node) => {
          const isHighlighted = hoveredNode === node.id;
          const isConnected = hoveredNode && links.some(l =>
            (l.source === node.id && l.target === hoveredNode) ||
            (l.target === node.id && l.source === hoveredNode)
          );

          const opacity = hoveredNode ? (isHighlighted || isConnected ? 1 : 0.2) : 1;
          const radius = 15 + (node.val || 5) * 1.2;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer transition-opacity duration-300"
              style={{ opacity }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => window.location.href = `/tutor?new=1&topic_id=${node.id}`}
            >
              {/* Outer glow effect */}
              <circle
                r={radius + 4}
                fill={node.group === 1 ? "var(--color-primary)" : "var(--color-secondary)"}
                opacity={isHighlighted ? 0.3 : 0}
                className="transition-opacity duration-300"
              />
              <circle
                r={radius}
                fill={node.group === 1 ? "var(--color-primary)" : "var(--color-secondary)"}
                stroke="var(--color-surface)"
                strokeWidth={2}
                className="transition-transform duration-300 hover:scale-105 drop-shadow-md"
              />
              <text
                y={radius + 18}
                textAnchor="middle"
                className="text-[10px] font-bold fill-on-surface select-none pointer-events-none drop-shadow-sm"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
