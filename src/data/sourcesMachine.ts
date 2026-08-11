import type { Source } from '../types'

export const machineSources: Source[] = [
  {
    id: 'mac-davis1952',
    author: 'K. H. Davis; R. Biddulph; Stephen Balashek',
    year: '1952',
    title: 'Automatic Recognition of Spoken Digits',
    publication: 'Journal of the Acoustical Society of America 24(6)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1121/1.1906946',
    note:
      'Primary technical report of the Bell Labs single-speaker, isolated-digit recogniser later associated with the name AUDREY. Its 97–99 per cent result belongs to one trained speaker and ten telephone-bandwidth digits, not general speech recognition.',
  },
  {
    id: 'mac-audrey1953',
    author: 'TIME editorial staff',
    year: '1953',
    title: 'Science: New Wrinkles',
    publication: 'TIME, 26 January 1953',
    type: 'primary document',
    url: 'https://time.com/archive/6620141/science-new-wrinkles-2/',
    note:
      'Contemporary public account that expands AUDREY as “automatic digit recognition” and describes the demonstration. Its anthropomorphic and gendered language is evidence of period framing, not neutral technical terminology.',
  },
  {
    id: 'mac-ibm-shoebox',
    author: 'IBM',
    year: '2021; updated 2025',
    title: 'Speech Recognition: When a Machine First Understood Human Speech',
    publication: 'IBM History',
    type: 'scholarly history',
    url: 'https://www.ibm.com/history/voice-recognition',
    note:
      'IBM archival history of William Dersch’s Shoebox demonstrations, including the 1962 Seattle World’s Fair. As a corporate retrospective, it is authoritative for the company’s holdings but should not settle global priority claims by itself.',
  },
  {
    id: 'mac-lowerre1976',
    author: 'Bruce T. Lowerre',
    year: '1976',
    title: 'The HARPY Speech Recognition System',
    publication: 'Carnegie Mellon University PhD thesis',
    type: 'primary document',
    url: 'https://iiif.library.cmu.edu/file/Newell_box00103_fld07932_doc0001/Newell_box00103_fld07932_doc0001.pdf',
    note:
      'Detailed primary account of HARPY’s network search and evaluation. Vocabulary size and task performance are properties of its constrained sentence domain, grammar and 1970s test conditions.',
  },
  {
    id: 'mac-rabiner1989',
    author: 'Lawrence R. Rabiner',
    year: '1989',
    title: 'A Tutorial on Hidden Markov Models and Selected Applications in Speech Recognition',
    publication: 'Proceedings of the IEEE 77(2)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1109/5.18626',
    note:
      'Canonical tutorial on HMM states, observations, estimation and decoding in speech recognition. It explains a model family and historical practice rather than prescribing a current end-to-end architecture.',
  },
  {
    id: 'mac-hinton2012',
    author:
      'Geoffrey Hinton; Li Deng; Dong Yu; George Dahl; Abdel-rahman Mohamed; Navdeep Jaitly; Andrew Senior; Vincent Vanhoucke; Patrick Nguyen; Tara Sainath; Brian Kingsbury',
    year: '2012',
    title: 'Deep Neural Networks for Acoustic Modeling in Speech Recognition',
    publication: 'IEEE Signal Processing Magazine 29(6)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1109/MSP.2012.2205597',
    note:
      'Multi-laboratory account of the shift from Gaussian-mixture acoustic scoring towards deep neural networks. The reported gains are benchmark- and system-specific and did not, by themselves, remove HMMs or engineered front ends.',
  },
  {
    id: 'mac-graves2006',
    author: 'Alex Graves; Santiago Fernández; Faustino Gomez; Jürgen Schmidhuber',
    year: '2006',
    title:
      'Connectionist Temporal Classification: Labelling Unsegmented Sequence Data with Recurrent Neural Networks',
    publication: 'Proceedings of the 23rd International Conference on Machine Learning',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1145/1143844.1143891',
    note:
      'Original CTC paper. CTC sums over compatible alignments by using a blank label and collapse rule; it does not mean that timing, segmentation or decoding assumptions disappear.',
  },
  {
    id: 'mac-dudley1939',
    author: 'Homer Dudley',
    year: '1939',
    title: 'The Vocoder',
    publication: 'Bell Laboratories Record 18(4)',
    type: 'primary document',
    url: 'https://www.worldradiohistory.com/Archive-Bell-Laboratories-Record/30s/Bell-Laboratories-Record-1939-12.pdf',
    note:
      'Contemporary technical description of the vocoder and its manually controlled Voder offshoot by their Bell Labs inventor. Period claims about novelty should be read alongside other synthesis histories.',
  },
  {
    id: 'mac-voder-time1939',
    author: 'TIME editorial staff',
    year: '1939',
    title: 'Science: Voder',
    publication: 'TIME, 16 January 1939',
    type: 'primary document',
    url: 'https://time.com/archive/6768952/science-voder/',
    note:
      'Contemporary report of a Franklin Institute Voder demonstration and the intensive training of selected telephone operators. It is useful evidence for reception and labour, not a circuit specification.',
  },
  {
    id: 'mac-loc-daisy',
    author: 'Christopher DeLaurenti; Library of Congress',
    year: '2010; registry essay 2024',
    title: '“Daisy Bell (Bicycle Built for Two)”—Max Mathews',
    publication: 'National Recording Registry',
    type: 'scholarly history',
    url: 'https://www.loc.gov/static/programs/national-recording-preservation-board/documents/DaisyBell.pdf',
    note:
      'Curatorial essay on the 1961 Bell Labs computer-sung recording and its cultural afterlife, including Arthur C. Clarke’s encounter with the demonstration. It distinguishes speech synthesis from Max Mathews’s separately programmed accompaniment.',
  },
  {
    id: 'mac-ieee-speakspell',
    author: 'IEEE History Center',
    year: '2009',
    title: 'Speak & Spell, the First Use of a Digital Signal Processing IC for Speech Generation, 1978',
    publication: 'IEEE Milestones',
    type: 'official documentation',
    url: 'https://ethw.org/Milestones%3ASpeak_%26_Spell%2C_the_First_Use_of_a_Digital_Signal_Processing_IC_for_Speech_Generation%2C_1978',
    note:
      'Official milestone record for the 1978 Texas Instruments product and its LPC speech chip. “First” is scoped to the milestone’s stated single-chip DSP achievement, not all electronic speech synthesis.',
  },
  {
    id: 'mac-klatt1987',
    author: 'Dennis H. Klatt',
    year: '1987',
    title: 'Review of Text-to-Speech Conversion for English',
    publication: 'Journal of the Acoustical Society of America 82(3)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1121/1.395275',
    note:
      'Landmark technical and historical review by the developer of MITalk and the Klatt synthesiser lineage. Its scope is English and its account predates corpus-based and neural synthesis.',
  },
  {
    id: 'mac-hawking-archive',
    author: 'Susan Gordon; Katrina Dean; Jessica Gardner; et al.',
    year: '2024',
    title: 'Collaboration and Mediation: A Guide to the Creation of the Stephen Hawking Archive',
    publication: 'Science Museum Group Journal 21',
    type: 'scholarly history',
    url: 'https://journal.sciencemuseum.ac.uk/article/collaboration-and-mediation-a-guide-to-the-creation-of-the-stephen-hawking-archive/',
    note:
      'Archive-based account of Hawking’s communication equipment and voice, including the Speech Plus CallText hardware and Klatt-derived synthesis. It cautions against casually naming every instance of his system “DECtalk”.',
  },
  {
    id: 'mac-tacotron2017',
    author:
      'Yuxuan Wang; R. J. Skerry-Ryan; Daisy Stanton; Yonghui Wu; Ron J. Weiss; Navdeep Jaitly; et al.',
    year: '2017',
    title: 'Tacotron: Towards End-to-End Speech Synthesis',
    publication: 'Interspeech 2017',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.21437/Interspeech.2017-1452',
    note:
      'Original Tacotron conference paper mapping characters to spectrogram frames with a sequence-to-sequence model. “End-to-end” refers to reduced hand-engineering inside the studied TTS stack, not removal of text processing, data or waveform generation.',
  },
  {
    id: 'mac-wavenet2016',
    author:
      'Aäron van den Oord; Sander Dieleman; Heiga Zen; Karen Simonyan; Oriol Vinyals; Alex Graves; et al.',
    year: '2016',
    title: 'WaveNet: A Generative Model for Raw Audio',
    publication: 'arXiv:1609.03499',
    type: 'research preprint',
    url: 'https://arxiv.org/abs/1609.03499',
    note:
      'Primary research disclosure of autoregressive waveform modelling. Naturalness comparisons are those reported for the paper’s listening tests; the original sample-by-sample generator was computationally demanding.',
  },
  {
    id: 'mac-gray-suri2019',
    author: 'Mary L. Gray; Siddharth Suri',
    year: '2019',
    title: 'Ghost Work: How to Stop Silicon Valley from Building a New Global Underclass',
    publication: 'Houghton Mifflin Harcourt',
    type: 'scholarly history',
    url: 'https://ghostwork.info/',
    note:
      'Interview- and fieldwork-based study of the human labour hidden inside apparently automated systems. It supplies broad labour context; it is not a census of any one speech dataset or vendor.',
  },
  {
    id: 'mac-datasheets2021',
    author: 'Timnit Gebru; Jamie Morgenstern; Briana Vecchione; Jennifer Wortman Vaughan; Hanna Wallach; et al.',
    year: '2021',
    title: 'Datasheets for Datasets',
    publication: 'Communications of the ACM 64(12)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1145/3458723',
    note:
      'Framework for documenting dataset motivation, composition, collection, preprocessing, uses and maintenance. A datasheet improves scrutiny but does not itself make collection representative, consensual or harmless.',
  },
  {
    id: 'mac-commonvoice2020',
    author: 'Rosana Ardila; Megan Branson; Kelly Davis; Michael Henretty; Michael Kohler; et al.',
    year: '2020',
    title: 'Common Voice: A Massively-Multilingual Speech Corpus',
    publication: 'Proceedings of LREC 2020',
    type: 'peer-reviewed research',
    url: 'https://aclanthology.org/2020.lrec-1.520/',
    note:
      'Corpus paper describing volunteer recording, validation, demographic metadata and speaker-disjoint splits. Its diversity ambitions do not guarantee balanced coverage within every language, accent or release.',
  },
  {
    id: 'mac-koenecke2020',
    author: 'Allison Koenecke; Andrew Nam; Emily Lake; Joe Nudell; Minnie Quartey; et al.',
    year: '2020',
    title: 'Racial Disparities in Automated Speech Recognition',
    publication: 'Proceedings of the National Academy of Sciences 117(14)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1073/pnas.1915768117',
    note:
      'Audit of five commercial ASR systems on two US English interview corpora, reporting materially higher average word error rates for Black speakers. The result is consequential but scoped; it is not a timeless ranking of vendors or all dialects.',
  },
  {
    id: 'mac-nist-sre2024',
    author: 'National Institute of Standards and Technology',
    year: '2024',
    title: 'NIST 2024 Speaker Recognition Evaluation Plan',
    publication: 'NIST Speaker Recognition Evaluation',
    type: 'official documentation',
    url: 'https://www.nist.gov/system/files/documents/2024/06/11/NIST_2024_Speaker_Recognition_Evaluation_Plan.pdf',
    note:
      'Formal definition, protocol and metrics for text-independent target-speaker detection under stated telephone, video, multilingual and multi-speaker conditions. Evaluation scores do not amount to categorical identity proof.',
  },
  {
    id: 'mac-anguera2012',
    author: 'Xavier Anguera Miró; Simon Bozonnet; Nicholas Evans; Corinne Fredouille; Gerald Friedland',
    year: '2012',
    title: 'Speaker Diarization: A Review of Recent Research',
    publication: 'IEEE Transactions on Audio, Speech, and Language Processing 20(2)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1109/TASL.2011.2125954',
    note:
      'Review of “who spoke when” segmentation and clustering. Diarisation labels streams with within-recording speaker clusters; it need not establish a civil identity.',
  },
  {
    id: 'mac-milner2022',
    author: 'Rosanna Milner; Md Asif Jalal; Raymond W. M. Ng; Thomas Hain',
    year: '2022',
    title: 'A Cross-Corpus Study on Speech Emotion Recognition',
    publication: 'arXiv:2207.02104',
    type: 'research preprint',
    url: 'https://arxiv.org/abs/2207.02104',
    note:
      'Cross-corpus experiments showing degradation and annotation-domain problems between acted, elicited and natural emotional-speech datasets. It supports caution about generalisation, not the claim that vocal affect carries no information.',
  },
  {
    id: 'mac-nist-80063b4',
    author: 'David Temoshok; Yee-Yin Choong; Andrew Regenscheid; Ryan Galluzzo; James Fenton; et al.',
    year: '2025',
    title: 'NIST Special Publication 800-63B-4: Authentication and Authenticator Management',
    publication: 'National Institute of Standards and Technology',
    type: 'standard',
    url: 'https://doi.org/10.6028/NIST.SP.800-63B-4',
    note:
      'Current US federal digital-authentication guidance. It prohibits biometric comparison based on voice in its covered authentication workflows; that scoped rule is not a ban on speaker-recognition research, accessibility tools or all forensic practice.',
  },
  {
    id: 'mac-soundstream2021',
    author: 'Neil Zeghidour; Alejandro Luebs; Ahmed Omran; Jan Skoglund; Marco Tagliasacchi',
    year: '2021',
    title: 'SoundStream: An End-to-End Neural Audio Codec',
    publication: 'IEEE/ACM Transactions on Audio, Speech, and Language Processing 30',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1109/TASLP.2021.3129994',
    note:
      'Neural codec using a convolutional encoder/decoder and residual vector quantisation. Its bitrate and listening results belong to the reported models, data, losses and test protocol.',
  },
  {
    id: 'mac-encodec2022',
    author: 'Alexandre Défossez; Jade Copet; Gabriel Synnaeve; Yossi Adi',
    year: '2022',
    title: 'High Fidelity Neural Audio Compression',
    publication: 'arXiv:2210.13438',
    type: 'research preprint',
    url: 'https://arxiv.org/abs/2210.13438',
    note:
      'Primary EnCodec research report describing a streaming encoder-decoder, quantised latent space and perceptual training objectives. Codec codes are model-specific indices, not universal acoustic atoms.',
  },
  {
    id: 'mac-audiolm2023',
    author:
      'Zalán Borsos; Raphaël Marinier; Damien Vincent; Eugene Kharitonov; Olivier Pietquin; Matt Sharifi; et al.',
    year: '2023',
    title: 'AudioLM: A Language Modeling Approach to Audio Generation',
    publication: 'IEEE/ACM Transactions on Audio, Speech, and Language Processing 31',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1109/TASLP.2023.3288409',
    note:
      'AudioLM combines semantic and acoustic token streams to model long structure and reconstruction quality. Prompt continuations are research demonstrations, not evidence that tokens retain every property of the source waveform.',
  },
  {
    id: 'mac-valle2023',
    author: 'Chengyi Wang; Sanyuan Chen; Yu Wu; Ziqiang Zhang; Long Zhou; Shujie Liu; et al.',
    year: '2023',
    title: 'Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers',
    publication: 'arXiv:2301.02111',
    type: 'research preprint',
    url: 'https://arxiv.org/abs/2301.02111',
    note:
      'Original VALL-E research disclosure treating codec indices as language-model tokens and reporting prompt-conditioned speaker and acoustic-context transfer. The three-second prompt and quality claims are experimental, not a universal cloning threshold.',
  },
  {
    id: 'mac-sohn1999',
    author: 'Jongseo Sohn; Nam Soo Kim; Wonyong Sung',
    year: '1999',
    title: 'A Statistical Model-Based Voice Activity Detection',
    publication: 'IEEE Signal Processing Letters 6(1)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1109/97.736233',
    note:
      'Influential statistical VAD for speech coding. Voice activity detection estimates speech/non-speech regions under a model; it does not infer conversational intention or reliably solve every noise condition.',
  },
  {
    id: 'mac-sacks1974',
    author: 'Harvey Sacks; Emanuel A. Schegloff; Gail Jefferson',
    year: '1974',
    title: 'A Simplest Systematics for the Organization of Turn-Taking for Conversation',
    publication: 'Language 50(4)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.2307/412243',
    note:
      'Foundational conversation-analysis account of locally managed turn-taking. Its model describes social organisation, not a fixed silence timer ready to transplant into software.',
  },
  {
    id: 'mac-stivers2009',
    author: 'Tanya Stivers; N. J. Enfield; Penelope Brown; Christina Englert; Makoto Hayashi; et al.',
    year: '2009',
    title: 'Universals and Cultural Variation in Turn-Taking in Conversation',
    publication: 'Proceedings of the National Academy of Sciences 106(26)',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1073/pnas.0903616106',
    note:
      'Study of question-response timing across ten languages. It found shared organisation alongside culturally meaningful timing differences; it does not define one globally “natural” latency target.',
  },
  {
    id: 'mac-moshi2024',
    author:
      'Alexandre Défossez; Laurent Mazaré; Manu Orsini; Amélie Royer; Patrick Pérez; Hervé Jégou; Edouard Grave; Neil Zeghidour',
    year: '2024',
    title: 'Moshi: A Speech-Text Foundation Model for Real-Time Dialogue',
    publication: 'arXiv:2410.00037',
    type: 'research preprint',
    url: 'https://arxiv.org/abs/2410.00037',
    note:
      'Research report of parallel user/system audio streams, text-audio token generation and reported theoretical/practical latency. “Full duplex” describes the architecture’s simultaneous streams, not human-level conversational understanding.',
  },
  {
    id: 'mac-openai-realtime',
    author: 'OpenAI',
    year: 'accessed 10 August 2026',
    title: 'Realtime API Reference',
    publication: 'OpenAI Platform Documentation',
    type: 'vendor disclosure',
    url: 'https://platform.openai.com/docs/api-reference/realtime',
    note:
      'Living vendor documentation for bidirectional sessions, server and semantic VAD, and response interruption controls as accessed on the stated date. It is not an independent latency, quality or reliability evaluation.',
  },
  {
    id: 'mac-google-live',
    author: 'Google',
    year: 'accessed 10 August 2026',
    title: 'Gemini Live API: Capabilities Guide',
    publication: 'Google AI for Developers',
    type: 'vendor disclosure',
    url: 'https://ai.google.dev/gemini-api/docs/live-api/capabilities',
    note:
      'Living vendor documentation for streaming audio, configurable activity detection and barge-in as accessed on the stated date. Preview status, model availability and behaviour can change.',
  },
  {
    id: 'mac-amazon-nova',
    author: 'Amazon Web Services',
    year: 'accessed 10 August 2026',
    title: 'Using the Bidirectional Streaming API',
    publication: 'Amazon Nova Documentation',
    type: 'vendor disclosure',
    url: 'https://docs.aws.amazon.com/nova/latest/userguide/speech-bidirection.html',
    note:
      'Living vendor description of a persistent bidirectional audio/event stream as accessed on the stated date. Documentation establishes the published interface, not comparative naturalness or full-duplex social competence.',
  },
  {
    id: 'mac-asha-aac',
    author: 'American Speech-Language-Hearing Association',
    year: 'living guidance; accessed 2026',
    title: 'Augmentative and Alternative Communication (AAC)',
    publication: 'ASHA Practice Portal',
    type: 'official documentation',
    url: 'https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/',
    note:
      'Peer-reviewed clinical-practice guidance covering unaided and aided AAC, speech-generating devices, message banking, multimodal communication and collaborative personalisation. Individual assessment and preference remain essential.',
  },
  {
    id: 'mac-w3c-webuse',
    author: 'W3C Web Accessibility Initiative Education and Outreach Working Group',
    year: '2024',
    title: 'Tools and Techniques: How People with Disabilities Use the Web',
    publication: 'W3C Web Accessibility Initiative',
    type: 'official documentation',
    url: 'https://www.w3.org/WAI/people-use-web/tools-techniques/',
    note:
      'User-centred overview of screen readers, text-to-speech, speech recognition, switches and other access methods. The examples are explicitly non-exhaustive and should not become assumptions about any individual.',
  },
  {
    id: 'mac-w3c-media',
    author: 'W3C Accessible Platform Architectures Working Group',
    year: '2025',
    title: 'Media Accessibility User Requirements',
    publication: 'W3C Working Group Note',
    type: 'official documentation',
    url: 'https://www.w3.org/TR/media-accessibility-reqs/',
    note:
      'Requirements analysis for captions, transcripts, description, sign-language presentation and user customisation. It explains why no single audio or text rendering serves every access need.',
  },
  {
    id: 'mac-who-hearing',
    author: 'World Health Organization',
    year: '2021',
    title: 'World Report on Hearing',
    publication: 'World Health Organization',
    type: 'official documentation',
    url: 'https://www.who.int/publications/i/item/9789240020481',
    note:
      'Global evidence synthesis advocating integrated, people-centred ear and hearing care and multiple communication supports. Population estimates and policy recommendations should not be used to define an individual’s identity or preferred language.',
  },
  {
    id: 'mac-willett2023',
    author:
      'Francis R. Willett; Erin M. Kunz; Chaofei Fan; Donald T. Avansino; Guy H. Wilson; Eun Young Choi; et al.',
    year: '2023',
    title: 'A High-Performance Speech Neuroprosthesis',
    publication: 'Nature 620',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1038/s41586-023-06377-x',
    note:
      'Intracortical proof-of-concept decoding attempted speech to text for one participant with ALS. Reported rates and errors are participant-, implant-, vocabulary- and session-specific and do not establish general clinical availability.',
  },
  {
    id: 'mac-metzger2023',
    author:
      'Sean L. Metzger; Kaylo T. Littlejohn; Alexander B. Silva; David A. Moses; Margaret P. Seaton; et al.',
    year: '2023',
    title: 'A High-Performance Neuroprosthesis for Speech Decoding and Avatar Control',
    publication: 'Nature 620',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.1038/s41586-023-06443-4',
    note:
      'Clinical-trial report of attempted-speech decoding to text, synthesised audio and avatar movement for one participant. Personalisation towards a pre-injury voice was demonstrated under experimental conditions.',
  },
  {
    id: 'mac-agency-neuro2023',
    author: 'Narayan Sankaran; David A. Moses; Winston Chiong; Edward F. Chang',
    year: '2023',
    title: 'Recommendations for Promoting User Agency in the Design of Speech Neuroprostheses',
    publication: 'Frontiers in Human Neuroscience 17',
    type: 'peer-reviewed research',
    url: 'https://doi.org/10.3389/fnhum.2023.1298129',
    note:
      'Ethics and design analysis centring reliable control, error correction and communication customisation. Recommendations require continuing work with users; they are not evidence that present systems already satisfy those conditions.',
  },
  {
    id: 'mac-un-crpd',
    author: 'United Nations General Assembly',
    year: '2006',
    title: 'Convention on the Rights of Persons with Disabilities',
    publication: 'United Nations Treaty Series 2515',
    type: 'primary document',
    url: 'https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-rights-persons-disabilities',
    note:
      'International human-rights treaty requiring respect for individual autonomy and close consultation with disabled people through their representative organisations. Legal application depends on jurisdiction and ratification status.',
  },
  {
    id: 'mac-nist-synthetic',
    author: 'Bilva Chandra; Jesse Dunietz; Kathleen Roberts; Yooyoung Lee; Peter Fontana; George Awad',
    year: '2024; updated 2026',
    title: 'Reducing Risks Posed by Synthetic Content: An Overview of Technical Approaches to Digital Content Transparency',
    publication: 'NIST AI 100-4',
    type: 'official documentation',
    url: 'https://doi.org/10.6028/NIST.AI.100-4',
    note:
      'NIST analysis of provenance, watermarking, detection, prevention, testing and auditing. It treats these as complementary approaches with limitations, not a single reliable “real or fake” oracle.',
  },
  {
    id: 'mac-c2pa24',
    author: 'Coalition for Content Provenance and Authenticity',
    year: '2026',
    title: 'C2PA Technical Specification, version 2.4',
    publication: 'C2PA Specifications',
    type: 'standard',
    url: 'https://spec.c2pa.org/specifications/specifications/2.4/index.html',
    note:
      'Open standard for cryptographically verifiable assertions and provenance attached to digital assets. Validation protects the signed claim and bindings; trust in the signer, truth of the depicted event, consent and completeness remain separate questions, and manifests may be unavailable.',
  },
  {
    id: 'mac-ftc-voice',
    author: 'United States Federal Trade Commission',
    year: '2023–2024',
    title: 'The FTC Voice Cloning Challenge',
    publication: 'Federal Trade Commission',
    type: 'official documentation',
    url: 'https://www.ftc.gov/news-events/contests/ftc-voice-cloning-challenge',
    note:
      'Official record of an exploratory challenge addressing fraud, biometric-data misuse and creative-content misuse through technical and non-technical interventions. It does not endorse one winning method as a complete safeguard.',
  },
  {
    id: 'mac-nist-airmf',
    author: 'Elham Tabassi',
    year: '2023',
    title: 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)',
    publication: 'NIST AI 100-1',
    type: 'official documentation',
    url: 'https://doi.org/10.6028/NIST.AI.100-1',
    note:
      'Voluntary, use-case-sensitive framework organised around Govern, Map, Measure and Manage. It supplies risk-management outcomes rather than certifying any model or defining a product architecture.',
  },
  {
    id: 'mac-webauthn3',
    author: 'W3C Web Authentication Working Group',
    year: '2026',
    title: 'Web Authentication: An API for Accessing Public Key Credentials — Level 3',
    publication: 'W3C Candidate Recommendation Snapshot',
    type: 'standard',
    url: 'https://www.w3.org/TR/webauthn-3/',
    note:
      'Specification for scoped public-key credentials mediated by user agents and authenticators. Authentication can establish control of a credential; an application still has to decide whether a requested action is authorised and appropriate.',
  },
]
