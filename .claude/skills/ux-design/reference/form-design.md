# Form Design - Comprehensive Guide

This file covers form validation, error handling, input patterns, and form UX best practices.

## Table of Contents

1. [Form Layout & Structure](#form-layout--structure)
2. [Input Fields](#input-fields)
3. [Validation Patterns](#validation-patterns)
4. [Error Handling](#error-handling)
5. [Multi-Step Forms](#multi-step-forms)
6. [Form Submission](#form-submission)

---

## Form Layout & Structure

### Single Column Layout

**Best practice**: Single column forms are easier to complete.

```tsx
// ✓ Good: Single column
<form className="max-w-md space-y-6">
  <FormField label="Name" />
  <FormField label="Email" />
  <FormField label="Phone" />
  <FormField label="Address" />
  <Button type="submit">Submit</Button>
</form>

// ❌ Bad: Multi-column (harder to scan)
<form className="grid grid-cols-2 gap-4">
  <FormField label="First Name" />
  <FormField label="Last Name" />
  <FormField label="Email" />
  <FormField label="Phone" />
</form>
```

**Exception**: Related fields can be grouped horizontally:

```tsx
// First and last name together
<div className="grid grid-cols-2 gap-4">
  <FormField label="First Name" />
  <FormField label="Last Name" />
</div>

// City, State, ZIP
<div className="grid grid-cols-2 gap-4">
  <FormField label="City" className="col-span-1" />
  <div className="grid grid-cols-2 gap-2">
    <FormField label="State" />
    <FormField label="ZIP" />
  </div>
</div>
```

### Label Position

**Top-aligned labels** (best for most forms):
- Fastest to complete
- Best for long labels
- Mobile-friendly

```tsx
<div className="space-y-1">
  <label className="block text-sm font-medium">
    Email address
  </label>
  <input type="email" className="w-full" />
</div>
```

**Left-aligned labels** (data entry forms):
- Compact
- Good for familiar data
- Harder on mobile

```tsx
<div className="flex items-center gap-4">
  <label className="w-32 text-sm font-medium text-right">
    Email address
  </label>
  <input type="email" className="flex-1" />
</div>
```

### Grouping Related Fields

```tsx
<form className="space-y-8">
  {/* Group 1: Personal Information */}
  <fieldset>
    <legend className="text-lg font-semibold mb-4">
      Personal Information
    </legend>
    <div className="space-y-4">
      <FormField label="Full Name" />
      <FormField label="Date of Birth" />
      <FormField label="Phone Number" />
    </div>
  </fieldset>

  {/* Group 2: Address */}
  <fieldset>
    <legend className="text-lg font-semibold mb-4">
      Address
    </legend>
    <div className="space-y-4">
      <FormField label="Street Address" />
      <FormField label="City" />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="State" />
        <FormField label="ZIP Code" />
      </div>
    </div>
  </fieldset>

  <Button type="submit">Continue</Button>
</form>
```

---

## Input Fields

### Text Inputs

**Best practices**:
- Use appropriate input types (email, tel, url, number)
- Set appropriate autocomplete attributes
- Provide clear labels and placeholders
- Show input constraints (character limits, format)

```tsx
export const TextField = ({
  label,
  type = 'text',
  placeholder,
  helperText,
  error,
  maxLength,
  required,
  ...props
}) => {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${props.id}-error` : helperText ? `${props.id}-helper` : undefined
        }
        className={`
          w-full px-4 py-2 border rounded-lg
          focus:outline-none focus:ring-2
          ${error
            ? 'border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:ring-blue-200'
          }
        `}
        {...props}
      />

      {/* Helper text */}
      {helperText && !error && (
        <p id={`${props.id}-helper`} className="text-sm text-gray-600">
          {helperText}
        </p>
      )}

      {/* Character count */}
      {maxLength && (
        <p className="text-sm text-gray-600 text-right">
          {value.length} / {maxLength}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p id={`${props.id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

// Usage
<TextField
  label="Email"
  type="email"
  placeholder="you@example.com"
  helperText="We'll never share your email"
  required
  autoComplete="email"
/>
```

### Select Dropdowns

**When to use**:
- 5-15 options (fewer: use radio buttons, more: use searchable dropdown)

```tsx
export const Select = ({ label, options, value, onChange, error, required }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>

    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={`
        w-full px-4 py-2 border rounded-lg bg-white
        focus:outline-none focus:ring-2
        ${error ? 'border-red-500' : 'border-gray-300'}
      `}
    >
      <option value="">Select an option</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    {error && (
      <p role="alert" className="text-sm text-red-600">{error}</p>
    )}
  </div>
);
```

### Radio Buttons

**When to use**: 2-5 mutually exclusive options

```tsx
export const RadioGroup = ({ label, options, value, onChange, error }) => (
  <fieldset>
    <legend className="block text-sm font-medium mb-2">{label}</legend>

    <div className="space-y-2">
      {options.map(option => (
        <label
          key={option.value}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="radio"
            name={label}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            className="w-4 h-4 text-blue-600"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>

    {error && (
      <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>
    )}
  </fieldset>
);
```

### Checkboxes

**When to use**: Multiple selections allowed

```tsx
export const CheckboxGroup = ({ label, options, value, onChange, error }) => (
  <fieldset>
    <legend className="block text-sm font-medium mb-2">{label}</legend>

    <div className="space-y-2">
      {options.map(option => (
        <label
          key={option.value}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            value={option.value}
            checked={value.includes(option.value)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...value, option.value]);
              } else {
                onChange(value.filter(v => v !== option.value));
              }
            }}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>

    {error && (
      <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>
    )}
  </fieldset>
);
```

### Date Inputs

**Use native date picker when possible**:

```tsx
<TextField
  label="Date of Birth"
  type="date"
  max={new Date().toISOString().split('T')[0]} // Can't be future date
/>
```

**For complex date selection, use a date picker library**:

```tsx
import { DatePicker } from '@/components/ui/date-picker';

<DatePicker
  label="Select date"
  value={date}
  onChange={setDate}
  minDate={new Date()}
  maxDate={addYears(new Date(), 1)}
  disabledDays={[0, 6]} // Disable weekends
/>
```

### File Upload

```tsx
export const FileUpload = ({ label, accept, maxSize, onUpload, error }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
      onUpload(droppedFile);
    }
  };

  const validateFile = (file: File) => {
    if (maxSize && file.size > maxSize) {
      alert(`File size must be less than ${maxSize / 1024 / 1024}MB`);
      return false;
    }
    return true;
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center
          cursor-pointer transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        `}
      >
        <input
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && validateFile(file)) {
              setFile(file);
              onUpload(file);
            }
          }}
          className="hidden"
          id="file-upload"
        />

        <label htmlFor="file-upload" className="cursor-pointer">
          {file ? (
            <div>
              <FileIcon className="w-12 h-12 mx-auto text-blue-600 mb-2" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-600">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <UploadIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
              <p className="font-medium">Drop file here or click to upload</p>
              <p className="text-sm text-gray-600">
                {accept} (max {maxSize / 1024 / 1024}MB)
              </p>
            </div>
          )}
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};
```

---

## Validation Patterns

### When to Validate

**Best practice**: Validate on blur (when field loses focus)

```typescript
// ❌ Bad: Validate on every keystroke (too aggressive)
<input onChange={e => validate(e.target.value)} />

// ✓ Good: Validate on blur
<input onBlur={e => validate(e.target.value)} />

// ✓ Also good: Validate on submit, show all errors
<form onSubmit={handleSubmit}>
```

### Validation Timing

```tsx
const FormField = ({ name, validate, ...props }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const handleBlur = () => {
    setTouched(true);
    const validationError = validate(value);
    setError(validationError);
  };

  const handleChange = (e) => {
    setValue(e.target.value);

    // If field has been touched and has error, re-validate on change
    if (touched && error) {
      const validationError = validate(e.target.value);
      setError(validationError);
    }
  };

  return (
    <div>
      <input
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={touched && !!error}
        {...props}
      />
      {touched && error && (
        <p role="alert" className="text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
};
```

### Common Validations

```typescript
// Email validation
export const validateEmail = (email: string) => {
  if (!email) {
    return 'Email is required';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address (e.g., user@example.com)';
  }
  return '';
};

// Password validation
export const validatePassword = (password: string) => {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return '';
};

// Phone validation
export const validatePhone = (phone: string) => {
  if (!phone) {
    return 'Phone number is required';
  }
  if (!/^\+?[\d\s\-()]+$/.test(phone)) {
    return 'Please enter a valid phone number';
  }
  return '';
};

// URL validation
export const validateURL = (url: string) => {
  if (!url) {
    return 'URL is required';
  }
  try {
    new URL(url);
    return '';
  } catch {
    return 'Please enter a valid URL (e.g., https://example.com)';
  }
};
```

### Real-Time Validation Indicators

```tsx
const PasswordField = () => {
  const [password, setPassword] = useState('');

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      />

      {/* Real-time requirements */}
      <ul className="space-y-1">
        {requirements.map((req, i) => (
          <li
            key={i}
            className={`text-sm flex items-center gap-2 ${
              req.met ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            {req.met ? (
              <CheckCircleIcon className="w-4 h-4" />
            ) : (
              <CircleIcon className="w-4 h-4" />
            )}
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

---

## Error Handling

### Error Message Guidelines

**Good error messages**:
1. **State what happened**: "Email is invalid"
2. **Explain why** (if helpful): "Email must include @"
3. **Suggest a solution**: "Please enter a valid email (e.g., user@example.com)"

```tsx
// ❌ Bad: Vague, technical
<ErrorMessage>Error 422: Validation failed</ErrorMessage>

// ❌ Bad: No suggestion
<ErrorMessage>Invalid email</ErrorMessage>

// ✓ Good: Clear, helpful
<ErrorMessage>
  Please enter a valid email address (e.g., user@example.com)
</ErrorMessage>

// ✓ Good: Specific, actionable
<ErrorMessage>
  Password must be at least 8 characters and include one number
</ErrorMessage>
```

### Inline Error Display

```tsx
<div className="space-y-1">
  <label htmlFor="email" className="block text-sm font-medium">
    Email
  </label>

  <div className="relative">
    <input
      id="email"
      type="email"
      aria-invalid={!!error}
      aria-describedby="email-error"
      className={`
        w-full px-4 py-2 border rounded-lg
        ${error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'}
      `}
    />

    {/* Error icon */}
    {error && (
      <XCircleIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
    )}
  </div>

  {/* Error message */}
  {error && (
    <div id="email-error" role="alert" className="flex items-start gap-2 text-sm text-red-600">
      <AlertIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{error}</span>
    </div>
  )}
</div>
```

### Form-Level Errors

```tsx
const Form = () => {
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm(formData);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      // Focus first error
      document.getElementById(`field-${validationErrors[0].field}`)?.focus();
      return;
    }

    // Submit form
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Error summary at top */}
      {errors.length > 0 && (
        <div
          role="alert"
          className="p-4 mb-6 bg-red-50 border border-red-200 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-2">
                Please fix the following errors:
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Form fields */}
    </form>
  );
};
```

---

## Multi-Step Forms

### Progress Indicator

```tsx
export const FormStepper = ({ steps, currentStep }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step circle */}
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center
                font-semibold transition-colors
                ${isCompleted
                  ? 'bg-green-600 text-white'
                  : isCurrent
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
                }
              `}
            >
              {isCompleted ? (
                <CheckIcon className="w-5 h-5" />
              ) : (
                index + 1
              )}
            </div>

            {/* Step label */}
            <div className="ml-3 flex-1">
              <p className={`text-sm font-medium ${
                isCurrent ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {step.label}
              </p>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-4 ${
                  isCompleted ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  </div>
);
```

### Multi-Step Form Pattern

```tsx
export const MultiStepForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});

  const steps = [
    { id: 'personal', label: 'Personal Info', component: PersonalInfoStep },
    { id: 'address', label: 'Address', component: AddressStep },
    { id: 'payment', label: 'Payment', component: PaymentStep },
    { id: 'review', label: 'Review', component: ReviewStep },
  ];

  const CurrentStepComponent = steps[currentStep].component;

  const handleNext = (data) => {
    setFormData({ ...formData, ...data });

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit form
      submitForm(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <FormStepper steps={steps} currentStep={currentStep} />

      <CurrentStepComponent
        data={formData}
        onNext={handleNext}
        onBack={handleBack}
        isFirst={currentStep === 0}
        isLast={currentStep === steps.length - 1}
      />
    </div>
  );
};

// Step component example
const PersonalInfoStep = ({ data, onNext, onBack, isFirst }) => {
  const [formData, setFormData] = useState(data);

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField
        label="Full Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <FormField
        label="Email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />

      <div className="flex justify-between">
        {!isFirst && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button type="submit" className={isFirst ? 'ml-auto' : ''}>
          Continue
        </Button>
      </div>
    </form>
  );
};
```

---

## Form Submission

### Loading State

```tsx
const Form = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.submitForm(formData);
      // Show success
    } catch (error) {
      // Show error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner className="mr-2" />
            Submitting...
          </>
        ) : (
          'Submit'
        )}
      </Button>
    </form>
  );
};
```

### Success Confirmation

```tsx
const Form = () => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  if (status === 'success') {
    return (
      <div className="text-center p-8">
        <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Success!</h2>
        <p className="text-gray-600 mb-6">
          Your form has been submitted successfully.
        </p>
        <Button onClick={handleReset}>Submit Another</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

---

## Form Design Checklist

- [ ] Single column layout (unless related fields)
- [ ] Clear, descriptive labels
- [ ] Required fields marked with *
- [ ] Appropriate input types (email, tel, date, etc.)
- [ ] Validation on blur, not on every keystroke
- [ ] Clear, helpful error messages
- [ ] Error messages associated with fields (aria-describedby)
- [ ] Success indicators for valid fields
- [ ] Loading state during submission
- [ ] Success confirmation after submission
- [ ] Multi-step forms show progress
- [ ] Form data is preserved when navigating back

---

**Sources**:
- Nielsen Norman Group: "Form Design Best Practices"
- Luke Wroblewski: "Web Form Design"
- Baymard Institute: Form usability research
- WCAG 2.1: Forms accessibility guidelines
