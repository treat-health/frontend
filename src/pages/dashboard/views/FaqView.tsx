import { useState } from 'react';
import { ChevronDown, ExternalLink, HelpCircle } from 'lucide-react';
import FullPagePanel from '../../../components/common/FullPagePanel';
import './FaqView.css';

/* ── Data ─────────────────────────────────────────────────────────── */

export const FAQS = [
    {
        question: 'What is Virtual IOP?',
        answer:
            'Virtual IOP is an intensive outpatient program you can attend from home. It includes structured therapy sessions, group support, and clinical care through secure online sessions. This allows you to receive consistent treatment without needing to stay at a facility.',
        link: 'https://treatmh.com/treatment/telehealth-and-virtual-therapy/',
        linkLabel: 'Learn about Virtual IOP',
        category: 'Virtual IOP',
        categoryColor: '#467174',
        categoryBg: '#E6F4F5',
    },
    {
        question: 'Who is a good fit for Virtual IOP?',
        answer:
            'Virtual IOP is ideal for individuals who need consistent support but can still live at home. It works well for those managing work, school, or family responsibilities while receiving care. It is a great option for people who want structured treatment with more flexibility.',
        link: 'https://treatmh.com/treatment/telehealth-and-virtual-therapy/',
        linkLabel: 'See if Virtual IOP is right for you',
        category: 'Virtual IOP',
        categoryColor: '#467174',
        categoryBg: '#E6F4F5',
    },
    {
        question: 'What are the benefits of Virtual IOP?',
        answer:
            'Virtual IOP offers flexibility and convenience without sacrificing quality care. You can access evidence-based therapy and/or psychiatry from home while staying connected to your daily life. It also allows you to apply what you learn in real time in your everyday environment.',
        link: 'https://treatmh.com/treatment/telehealth-and-virtual-therapy/',
        linkLabel: 'Explore the benefits',
        category: 'Virtual IOP',
        categoryColor: '#467174',
        categoryBg: '#E6F4F5',
    },
    {
        question: 'How do I know if I need Residential Treatment instead of Virtual IOP?',
        answer:
            'Residential treatment may be a better fit if you need constant support or are struggling to manage daily life. It is often recommended for individuals experiencing more severe symptoms or recent challenges. This setting provides a safe, structured space to focus fully on recovery.',
        link: 'https://treatmh.com/treatment/residential-treatment/',
        linkLabel: 'Learn about Residential Treatment',
        category: 'Residential',
        categoryColor: '#856644',
        categoryBg: '#F5EDE3',
    },
] as const;

/* ── Component ────────────────────────────────────────────────────── */

interface FaqViewProps {
    onClose: () => void;
}

export default function FaqView({ onClose }: Readonly<FaqViewProps>) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const toggle = (i: number) => setOpenIndex((prev) => (prev === i ? null : i));

    return (
        <FullPagePanel
            icon={HelpCircle}
            iconColor="var(--primary-700)"
            iconBg="var(--primary-100)"
            title="Frequently Asked Questions"
            subtitle="Everything you need to know about your care options"
            onClose={onClose}
        >
            {/* ── Intro banner ──────────────────────────── */}
            <div className="faqv-intro">
                <div className="faqv-intro-badge">
                    <HelpCircle size={13} />
                    Common Questions
                </div>
                <h2 className="faqv-intro-headline">
                    Your questions, answered
                </h2>
                <p className="faqv-intro-body">
                    Below are the most common questions about your treatment options. Each answer
                    includes a link to our website for deeper reading — tap "Learn more" to open
                    it in your browser.
                </p>
            </div>

            {/* ── FAQ items ─────────────────────────────── */}
            <ul className="faqv-list">
                {FAQS.map((faq, i) => {
                    const isOpen = openIndex === i;
                    return (
                        <li
                            key={faq.question}
                            className={`faqv-item${isOpen ? ' faqv-item--open' : ''}`}
                        >
                            {/* Trigger */}
                            <button
                                type="button"
                                className="faqv-trigger"
                                onClick={() => toggle(i)}
                                aria-expanded={isOpen}
                            >
                                <span
                                    className="faqv-category"
                                    style={{
                                        background: faq.categoryBg,
                                        color: faq.categoryColor,
                                    }}
                                >
                                    {faq.category}
                                </span>
                                <span className="faqv-question">{faq.question}</span>
                                <ChevronDown
                                    size={18}
                                    className="faqv-chevron"
                                    aria-hidden="true"
                                />
                            </button>

                            {/* Body */}
                            <div className="faqv-body" aria-hidden={!isOpen}>
                                <p className="faqv-answer">{faq.answer}</p>
                                <a
                                    href={faq.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="faqv-ext-link"
                                >
                                    <ExternalLink size={14} />
                                    {faq.linkLabel}
                                </a>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* ── Footer note ───────────────────────────── */}
            <div className="faqv-footer">
                <p className="faqv-footer-text">
                    Have a question not listed here? Reach out to your Client Care Coordinator
                    or visit{' '}
                    <a
                        href="https://treatmh.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="faqv-inline-link"
                    >
                        treatmh.com
                    </a>{' '}
                    for the full resource library.
                </p>
            </div>
        </FullPagePanel>
    );
}
