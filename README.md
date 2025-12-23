# Sleep Quality Research Website

A comprehensive web application for monitoring and analyzing sleep quality data from ThingSpeak across three test subjects.

## Overview

This website integrates with ThingSpeak IoT platform to fetch sleep quality data and provides:
- Individual subject pages with baseline and 3 nap sessions
- Form-based data collection for subjective sleep assessments
- Automatic correlation between objective sleep scores and subjective responses
- Comparative analysis across all subjects
- Data-driven conclusions and insights

## Features

### 1. ThingSpeak Integration
- Fetches real-time sleep quality data from ThingSpeak channels
- Supports multiple fields for different subjects and sessions
- Configurable channel ID and API key
- Automatic data parsing and display

### 2. Subject Management
- **3 Test Subjects** each with:
  - Baseline measurement (displayed at bottom of page)
  - 3 Nap sessions with individual data
  - Dedicated page for each subject

### 3. Response Forms
- Individual forms for each nap session
- Captures:
  - Sleep duration
  - Self-rated sleep quality (1-10)
  - Sleep disturbances
  - Additional notes
- Data synced with respective subject and nap session
- Persistent storage using browser localStorage

### 4. Analysis & Conclusions
- Automatic correlation between sleep scores and form responses
- Baseline comparisons for each nap session
- Overall trends and patterns
- Comparative analysis across subjects
- Data-driven recommendations

## File Structure

```
Sleep_quality_website/
├── index.html          # Home page with configuration
├── subject1.html       # Subject 1 data and forms
├── subject2.html       # Subject 2 data and forms
├── subject3.html       # Subject 3 data and forms
├── analysis.html       # Overall comparative analysis
├── styles.css          # Global styles
├── config.js           # ThingSpeak configuration management
├── thingspeak.js       # API integration and data analysis
├── subject.js          # Subject page controller
├── analysis.js         # Analysis page controller
└── README.md           # This file
```

## Setup Instructions

### 1. ThingSpeak Configuration

1. Open `index.html` in your browser
2. Configure your ThingSpeak settings:
   - **Channel ID**: Your ThingSpeak channel ID
   - **Read API Key**: Your channel's read API key
   - **Results per Query**: Number of data points to fetch (default: 100)
3. Click "Save Configuration"

### 2. Field Mapping

The application expects ThingSpeak fields to be organized as follows:

- **Subject 1**: 
  - Field 1: Baseline
  - Field 2: Nap 1
  - Field 3: Nap 2
  - Field 4: Nap 3

- **Subject 2**:
  - Field 5: Baseline
  - Field 6: Nap 1
  - Field 7: Nap 2
  - Field 8: Nap 3

- **Subject 3**:
  - Field 9: Baseline
  - Field 10: Nap 1
  - Field 11: Nap 2
  - Field 12: Nap 3

**Note**: If your ThingSpeak channel uses a different field mapping, you can modify the `fieldMapping` object in `thingspeak.js`.

## Usage Guide

### Viewing Subject Data

1. Navigate to any subject page (Subject 1, 2, or 3)
2. The page will automatically load:
   - Sleep scores from ThingSpeak
   - Timestamps for each measurement
   - Any previously saved form responses
3. Baseline data is displayed at the bottom of the page

### Completing Response Forms

1. For each nap session, fill out the response form:
   - Enter sleep duration in hours
   - Rate sleep quality (1-10)
   - Describe any disturbances
   - Add additional notes if needed
2. Click "Save Response"
3. Analysis will be automatically generated

### Viewing Analysis

**Individual Subject Analysis:**
- Located below each nap session's form
- Shows correlation between sleep score and responses
- Compares with baseline measurement

**Overall Analysis:**
- Navigate to the "Overall Analysis" page
- View summary table of all subjects
- Compare performance across subjects
- Review comprehensive conclusions

## Data Storage

- **ThingSpeak Configuration**: Stored in browser localStorage
- **Form Responses**: Stored in browser localStorage
- **Note**: Data persists in the browser but is not synced across devices

## Browser Compatibility

- Modern browsers with ES6 support
- Chrome, Firefox, Safari, Edge (latest versions)
- JavaScript must be enabled
- LocalStorage must be enabled

## Troubleshooting

### "Configuration not found" Error
- Go to the home page and configure ThingSpeak settings
- Ensure Channel ID and Read API Key are correct

### No Data Displayed
- Verify ThingSpeak channel has data
- Check that field numbers match the expected mapping
- Ensure Read API Key has proper permissions
- Check browser console for detailed error messages

### CORS Issues
- ThingSpeak API supports CORS by default
- If issues persist, check browser console
- Ensure you're using the correct API endpoint

## Development

### Running Locally

Simply open `index.html` in a web browser. No build process or server required.

### Modifying Field Mapping

Edit the `fieldMapping` object in `thingspeak.js`:

```javascript
const fieldMapping = {
    1: { baseline: 'field1', nap1: 'field2', nap2: 'field3', nap3: 'field4' },
    2: { baseline: 'field5', nap1: 'field6', nap2: 'field7', nap3: 'field8' },
    3: { baseline: 'field9', nap1: 'field10', nap2: 'field11', nap3: 'field12' }
};
```

### Customizing Analysis

Modify the `SleepAnalyzer` class in `thingspeak.js` to adjust:
- Sleep quality thresholds
- Analysis logic
- Conclusion generation

## License

This project is for educational purposes (ESW course).

## Support

For issues or questions, please contact the development team or refer to the course materials.
