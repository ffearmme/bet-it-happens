"use client";
import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { useApp } from '../../../lib/store';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';

export default function AdminAnswersPage() {
    const { user } = useApp();
    const [answers, setAnswers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnswers = async () => {
            if (!user || user.role !== 'admin') {
                return;
            }

            try {
                const q = query(
                    collection(db, 'privateAnswers'),
                    orderBy('submittedAt', 'desc')
                );
                const snapshot = await getDocs(q);

                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setAnswers(data);
            } catch (error) {
                console.error("Error fetching answers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnswers();
    }, [user]);

    const handleDelete = async (answerId) => {
        if (!confirm("Are you sure you want to permanently delete this answer?")) return;

        try {
            await deleteDoc(doc(db, 'privateAnswers', answerId));
            setAnswers(prev => prev.filter(ans => ans.id !== answerId));
        } catch (error) {
            console.error("Error deleting answer:", error);
            alert("Failed to delete answer: " + error.message);
        }
    };

    if (!user) return <div className="container min-h-screen pt-24 text-center">Loading...</div>;
    if (user.role !== 'admin') return <div className="container min-h-screen pt-24 text-center text-red-500">Access Denied</div>;

    return (
        <div className="container min-h-screen pt-24 pb-12">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin?tab=maintenance" className="btn btn-ghost p-2 rounded-full hover:bg-white/5">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 text-transparent bg-clip-text">
                    Secret Answers
                </h1>
            </div>

            <div className="card space-y-6">
                {loading ? (
                    <div className="text-center py-8 opacity-50">Loading answers...</div>
                ) : answers.length === 0 ? (
                    <div className="text-center py-8 opacity-50">No answers submitted yet.</div>
                ) : (
                    <div className="space-y-4">
                        {answers.map((ans, idx) => (
                            <div key={ans.id} className="p-4 bg-black/40 border border-white/5 rounded-lg flex flex-col gap-2">
                                <div className="flex justify-between items-start text-xs text-gray-400">
                                    <span className="font-mono">Token: {ans.id}</span>
                                    <span>{new Date(ans.submittedAt).toLocaleString()}</span>
                                </div>
                                <div className="text-sm font-medium text-gray-400 mt-2 mb-1">
                                    Q: {ans.question || "Why are you here?"}
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <div className="text-lg font-medium text-white break-words w-full pr-4">
                                        {ans.answer.startsWith('[') ? (
                                            <div className="flex flex-col gap-3 mt-2">
                                                {JSON.parse(ans.answer).map((qa, i) => (
                                                    <div key={i} className="pl-3 border-l-2 border-primary/50">
                                                        <div className="text-sm font-semibold text-gray-300">Q: {qa.question}</div>
                                                        <div className="text-base text-white mt-1">A: {qa.answer}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            `"${ans.answer}"`
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(ans.id)}
                                        className="btn btn-ghost hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition"
                                        title="Delete answer"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
