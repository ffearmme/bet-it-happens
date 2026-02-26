"use client";
import { useEffect, useState, Suspense } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

function InviteContent({ params }) {
    const { token } = params;
    const [status, setStatus] = useState('loading'); // 'loading', 'valid', 'invalid', 'error'
    const [errorMessage, setErrorMessage] = useState('');

    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [inputVal, setInputVal] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!token) {
            setStatus('invalid');
            setErrorMessage("No token provided.");
            return;
        }

        const verifyToken = async () => {
            try {
                const linkRef = doc(db, 'privateLinks', token);

                const linkDoc = await getDoc(linkRef);
                if (!linkDoc.exists()) {
                    throw new Error("Link does not exist.");
                }

                const data = linkDoc.data();
                if (data.used) {
                    throw new Error("Link has already been used.");
                }

                // Mark as used
                await updateDoc(linkRef, {
                    used: true,
                    usedAt: new Date().toISOString()
                });

                // Read and update successful, link was unused and is now marked used
                setStatus('valid');
            } catch (error) {
                console.error("Token verification failed:", error);
                setStatus('invalid');
                setErrorMessage(error.message || "Invalid or expired link.");
            }
        };

        verifyToken();
    }, [token]);

    const [hintLevel, setHintLevel] = useState(0);

    const questions = [
        { id: 'q1', text: 'What the secret password?', type: 'text', requiredAnswer: 'lizard' },
        { id: 'q2', text: "There are 2 rules. Don't refresh. Don't tell anyone. Understand?", type: 'options', options: ['Yes', 'No'], rejectOn: 'No' },
        { id: 'q3', text: 'All of the following will be denied if ever brought up to anyone. Understood?', type: 'options', options: ['Yes', 'No'], rejectOn: 'No' },
        { id: 'q4', text: 'Is there such a thing as "The One?"', type: 'options', options: ['Yes', 'No'] },
        { id: 'q5', text: 'On a scale from 1 (Not at all) to 10 (To die for) how worth it is love?', type: 'options', options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
        { id: 'q6', text: "When I told y'all about her did you/do you think I'm joking at all?", type: 'options', options: ['Yes', 'No'] },
        { id: 'q7', text: 'Would you believe me if I told you I have no clue why I feel like this?', type: 'options', options: ['Yes', 'No'] },
        { id: 'q8', text: "I REALLY wish I didn't. . .", type: 'options', options: ['Valid', "You Shouldn't"] },
        {
            id: 'q9',
            text: '*Ball Knowlege Required* If I told you a song off AH was made with her in mind which would you think it is?',
            type: 'text',
            hints: [
                "It's in the song title, almost obvious",
                "Maybe it wasn't as obvious as I though...seems like nobody remembers favorite songs anymore..."
            ]
        },
        { id: 'q10', text: "Well now that you know my deepest darkest secret (I swore I would never tell anyone when I wrote the song), I'll give you a choice to go deeper or quit now.", type: 'options', options: ['Deeper', "I'm done"], exitOn: "I'm done" },
        {
            id: 'q11',
            text: "I've met lots of girls since high school. Only one has been slighty attractive up until I met her. I'm keeping an open mind but this can't be normal right?",
            type: 'options',
            options: ["It's normal", "Definitely not normal"],
            hints: ["Talking about Autumn. I know you guys think I just say it to say it or something but I swear I've never truly seen love at first sight or the stars or whatever...except for once, and I don't know if I could even explain what it felt like."],
            hintLabel: "Read into it"
        },
        { id: 'q12a', text: "I've been disecting everything and I think I've finally figured something out. But it's going to sound really weird...", type: 'options', options: ["What is it?"] },
        { id: 'q12b', text: "I think I've said this to you, but I know that I am definitely more attracted to girls that are younger than me (notice the wording please) and I think she possesses that somehow. Don't worry, only a few more questions.", type: 'options', options: ["Thank goodness", "bet"] },
        { id: 'q13', text: "Would you like Perfect World, or Real World?", type: 'options', options: ["Perfect World", "Real World"] },
        { id: 'q14a', text: "She is 1-4 years younger than me, protostant, and not related to anybody close to me. Wow.", type: 'options', options: ["Real World"] },
        { id: 'q14b', text: "She is 4 years older (Non-neg) and not protostant (non-neg). The chances of her converting? 0.00001%.", type: 'options', options: ["Perfect World"] },
        { id: 'q15', text: "In closing, maybe I just want someone who plays the guitar or sings, but trust me I've met many. Maybe I'm destined to be single for longer/ever (which I'll stick to what I've said, being totally fine with). Or...idk\n\nAny thoughts?", type: 'text' }
    ];

    const resetToStart = () => {
        setStep(0);
        setAnswers([]);
        setInputVal('');
        setHintLevel(0);
    };

    const submitAllAnswers = async (finalAnswers, isEarly = false) => {
        try {
            await setDoc(doc(db, 'privateAnswers', token), {
                question: "Multi-step Questionnaire",
                answer: JSON.stringify(finalAnswers),
                submittedAt: new Date().toISOString()
            });
            setSubmitted(isEarly ? 'early' : 'full');
        } catch (error) {
            console.error("Failed to submit answers:", error);
            alert("Error submitting answers.");
        }
    };

    const handleTextSubmit = (e) => {
        e.preventDefault();
        const trimmed = inputVal.trim();
        if (trimmed === '') return;

        const currentQ = questions[step];
        if (currentQ.requiredAnswer && currentQ.requiredAnswer.toLowerCase() !== trimmed.toLowerCase()) {
            resetToStart();
            return;
        }

        saveAnswer(inputVal);
    };

    const handleOptionSubmit = async (val) => {
        const currentQ = questions[step];
        if (currentQ.rejectOn && currentQ.rejectOn === val) {
            resetToStart();
            return;
        }

        if (currentQ.exitOn && currentQ.exitOn === val) {
            const newAnswers = [...answers, { question: currentQ.text, answer: val }];
            setAnswers(newAnswers);
            setInputVal('');
            await submitAllAnswers(newAnswers, true);
            return;
        }

        saveAnswer(val);
    };

    const saveAnswer = async (val) => {
        const currentQ = questions[step];
        const newAnswers = [...answers, { question: currentQ.text, answer: val }];
        setAnswers(newAnswers);
        setInputVal('');

        if (currentQ.id === 'q13') {
            const nextIdx = val === 'Perfect World'
                ? questions.findIndex(q => q.id === 'q14a')
                : questions.findIndex(q => q.id === 'q14b');
            setStep(nextIdx);
            setHintLevel(0);
            return;
        }

        if (currentQ.id === 'q14a') {
            const q14bText = questions.find(q => q.id === 'q14b').text;
            const seen14b = newAnswers.some(a => a.question === q14bText);
            const nextIdx = seen14b
                ? questions.findIndex(q => q.id === 'q15')
                : questions.findIndex(q => q.id === 'q14b');
            setStep(nextIdx);
            setHintLevel(0);
            return;
        }

        if (currentQ.id === 'q14b') {
            const q14aText = questions.find(q => q.id === 'q14a').text;
            const seen14a = newAnswers.some(a => a.question === q14aText);
            const nextIdx = seen14a
                ? questions.findIndex(q => q.id === 'q15')
                : questions.findIndex(q => q.id === 'q14a');
            setStep(nextIdx);
            setHintLevel(0);
            return;
        }

        if (step + 1 < questions.length) {
            setStep(step + 1);
            setHintLevel(0);
        } else {
            await submitAllAnswers(newAnswers);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            backgroundColor: '#ffffff',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif'
        }}>
            {status === 'loading' && (
                <div style={{ fontSize: '14px', letterSpacing: '1px' }}>...</div>
            )}

            {status === 'invalid' && (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', marginBottom: '8px' }}>Access Denied</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{errorMessage}</div>
                </div>
            )}

            {status === 'valid' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '24px'
                }}>
                    {!submitted ? (
                        <>
                            <div style={{
                                fontSize: '24px',
                                fontWeight: '300',
                                letterSpacing: '0.5px',
                                textAlign: 'center',
                                maxWidth: '80%',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {questions[step].text}
                            </div>

                            {questions[step].type === 'text' ? (
                                <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <form onSubmit={handleTextSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <input
                                            type="text"
                                            value={inputVal}
                                            onChange={(e) => setInputVal(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '12px 0',
                                                fontSize: '16px',
                                                border: 'none',
                                                borderBottom: '1px solid #000',
                                                outline: 'none',
                                                backgroundColor: 'transparent',
                                                color: '#000',
                                                textAlign: 'center'
                                            }}
                                            autoFocus
                                        />
                                    </form>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '24px', marginTop: '16px', maxWidth: '400px' }}>
                                    {questions[step].options.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => handleOptionSubmit(opt)}
                                            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', outline: 'none', textDecoration: 'underline' }}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {questions[step].hints && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                                    {hintLevel > 0 && (
                                        <div style={{ fontSize: '14px', color: '#666', textAlign: 'center', fontStyle: 'italic', maxWidth: '300px' }}>
                                            {questions[step].hints[hintLevel - 1]}
                                        </div>
                                    )}
                                    {hintLevel < questions[step].hints.length && (
                                        <button
                                            onClick={() => setHintLevel(h => h + 1)}
                                            style={{ background: 'none', border: '1px solid #ccc', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                                        >
                                            {questions[step].hintLabel || (hintLevel === 0 ? "Need a hint?" : "Need another hint?")}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            fontSize: '18px',
                            fontWeight: '300',
                            letterSpacing: '0.5px',
                            color: '#000',
                            textAlign: 'center',
                            maxWidth: '400px',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {submitted === 'early'
                                ? "Thank you."
                                : "Thank you for listening to my...whatever that was. I def had to tell someone so I appreciate it. Again, if anyone sees any of this I have nothing to do with it, but I trust you :)"
                            }
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function InvitePage({ params }) {
    return (
        <Suspense fallback={<div className="container min-h-screen flex items-center justify-center pt-24" style={{ color: '#fff' }}>Loading...</div>}>
            <InviteContent params={params} />
        </Suspense>
    );
}
