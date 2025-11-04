// Global variables
let selectedFile = null;
let compressedPdfBytes = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultSection = document.getElementById('resultSection');
const fileName = document.getElementById('fileName');
const originalSize = document.getElementById('originalSize');
const originalSizeResult = document.getElementById('originalSizeResult');
const compressedSize = document.getElementById('compressedSize');
const savings = document.getElementById('savings');
const compressBtn = document.getElementById('compressBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const qualitySlider = document.getElementById('qualitySlider');

// Event Listeners
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
compressBtn.addEventListener('click', compressPDF);
downloadBtn.addEventListener('click', downloadCompressedPDF);
resetBtn.addEventListener('click', resetApp);

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        handleFile(files[0]);
    } else {
        alert('Please drop a PDF file');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        handleFile(file);
    } else {
        alert('Please select a PDF file');
    }
}

function handleFile(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    originalSize.textContent = formatFileSize(file.size);

    // Show processing section and hide upload section
    uploadSection.classList.add('hidden');
    processingSection.classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function compressPDF() {
    if (!selectedFile) return;

    // Disable compress button
    compressBtn.disabled = true;
    compressBtn.textContent = 'Compressing...';

    // Show progress
    progressContainer.classList.remove('hidden');
    updateProgress(10, 'Loading PDF...');

    try {
        // Read the file
        const arrayBuffer = await selectedFile.arrayBuffer();
        updateProgress(30, 'Analyzing PDF...');

        // Load the PDF
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        updateProgress(50, 'Compressing PDF...');

        // Get compression level from slider
        const compressionLevel = parseInt(qualitySlider.value);

        // Create a new PDF document
        const compressedDoc = await PDFLib.PDFDocument.create();

        // Copy pages with compression
        const pages = pdfDoc.getPages();
        for (let i = 0; i < pages.length; i++) {
            const [copiedPage] = await compressedDoc.copyPages(pdfDoc, [i]);
            compressedDoc.addPage(copiedPage);

            // Update progress
            const pageProgress = 50 + ((i + 1) / pages.length) * 30;
            updateProgress(pageProgress, `Compressing page ${i + 1} of ${pages.length}...`);
        }

        updateProgress(85, 'Optimizing...');

        // Serialize the PDF with compression
        const pdfBytes = await compressedDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: compressionLevel === 3 ? 50 : compressionLevel === 2 ? 30 : 20,
        });

        updateProgress(100, 'Complete!');

        compressedPdfBytes = pdfBytes;

        // Calculate compression ratio
        const originalSizeBytes = selectedFile.size;
        const compressedSizeBytes = pdfBytes.length;
        const savedBytes = originalSizeBytes - compressedSizeBytes;
        const savedPercentage = Math.round((savedBytes / originalSizeBytes) * 100);

        // Show results
        setTimeout(() => {
            showResults(originalSizeBytes, compressedSizeBytes, savedPercentage);
        }, 500);

    } catch (error) {
        console.error('Compression error:', error);
        alert('An error occurred while compressing the PDF. Please try again.');
        compressBtn.disabled = false;
        compressBtn.textContent = 'Compress PDF';
        progressContainer.classList.add('hidden');
    }
}

function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

function showResults(originalSizeBytes, compressedSizeBytes, savedPercentage) {
    processingSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    originalSizeResult.textContent = formatFileSize(originalSizeBytes);
    compressedSize.textContent = formatFileSize(compressedSizeBytes);

    if (savedPercentage > 0) {
        savings.textContent = `You saved ${savedPercentage}% (${formatFileSize(originalSizeBytes - compressedSizeBytes)})`;
    } else {
        savings.textContent = 'File is already optimized';
    }
}

function downloadCompressedPDF() {
    if (!compressedPdfBytes) return;

    // Create blob and download
    const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name.replace('.pdf', '_compressed.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function resetApp() {
    // Reset all variables
    selectedFile = null;
    compressedPdfBytes = null;
    fileInput.value = '';

    // Reset UI
    uploadSection.classList.remove('hidden');
    processingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    progressContainer.classList.add('hidden');

    // Reset button state
    compressBtn.disabled = false;
    compressBtn.textContent = 'Compress PDF';

    // Reset progress
    progressFill.style.width = '0%';
    progressText.textContent = 'Compressing...';

    // Reset slider
    qualitySlider.value = 2;
}
