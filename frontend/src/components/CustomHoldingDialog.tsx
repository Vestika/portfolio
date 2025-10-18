import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, AlertCircle } from 'lucide-react';

interface CustomHoldingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (holding: CustomHoldingData) => Promise<void>;
  initialSymbol?: string;
  initialPrice?: number;
  initialCurrency?: string;
  initialUnits?: number;
  initialName?: string;
}

export interface CustomHoldingData {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  units: number;
  is_custom: boolean;
}

const COMMON_CURRENCIES = ['USD', 'ILS', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];

export const CustomHoldingDialog: React.FC<CustomHoldingDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSymbol = '',
  initialPrice,
  initialCurrency = 'USD',
  initialUnits,
  initialName
}) => {
  const [formData, setFormData] = useState({
    symbol: initialSymbol.toUpperCase(),
    name: initialName || initialSymbol,
    price: initialPrice ? initialPrice.toString() : '',
    currency: initialCurrency,
    units: initialUnits ? initialUnits.toString() : ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when initial values change (for editing existing custom holdings)
  React.useEffect(() => {
    setFormData({
      symbol: initialSymbol.toUpperCase(),
      name: initialName || initialSymbol,
      price: initialPrice ? initialPrice.toString() : '',
      currency: initialCurrency || 'USD',
      units: initialUnits ? initialUnits.toString() : ''
    });
  }, [initialSymbol, initialPrice, initialCurrency, initialUnits, initialName]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = 'Price must be a positive number';
    }

    const units = parseFloat(formData.units);
    if (!formData.units || isNaN(units) || units <= 0) {
      newErrors.units = 'Units must be a positive number';
    }

    if (!formData.currency) {
      newErrors.currency = 'Currency is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const holdingData: CustomHoldingData = {
        symbol: formData.symbol.trim().toUpperCase(),
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        currency: formData.currency,
        units: parseFloat(formData.units),
        is_custom: true
      };

      await onSave(holdingData);
      
      // Reset form and close
      setFormData({
        symbol: '',
        name: '',
        price: '',
        currency: 'USD',
        units: ''
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Error saving custom holding:', error);
      setErrors({ submit: 'Failed to save custom holding. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      symbol: '',
      name: '',
      price: '',
      currency: 'USD',
      units: ''
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <Plus className="w-5 h-5 text-blue-400" />
            {initialPrice ? 'Edit' : 'Add'} Custom Holding: {formData.symbol}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {initialPrice 
              ? `Update the price and quantity for "${formData.name}".`
              : `Provide the price and quantity for "${formData.name}". This will be saved as a custom holding with manual pricing.`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">

          {/* Price and Currency Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm font-medium text-gray-200">
                Price per Unit <span className="text-red-400">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
              />
              {errors.price && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.price}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency" className="text-sm font-medium text-gray-200">
                Currency <span className="text-red-400">*</span>
              </Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {COMMON_CURRENCIES.map(currency => (
                    <SelectItem key={currency} value={currency} className="text-white hover:bg-gray-700">
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currency && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.currency}
                </p>
              )}
            </div>
          </div>

          {/* Units */}
          <div className="space-y-2">
            <Label htmlFor="units" className="text-sm font-medium text-gray-200">
              Number of Units <span className="text-red-400">*</span>
            </Label>
            <Input
              id="units"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.units}
              onChange={(e) => setFormData({ ...formData, units: e.target.value })}
              placeholder="0"
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
            />
            {errors.units && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.units}
              </p>
            )}
          </div>

          {/* Total Value Preview */}
          {formData.price && formData.units && !isNaN(parseFloat(formData.price)) && !isNaN(parseFloat(formData.units)) && (
            <div className="p-3 bg-blue-500/10 border border-blue-400/30 rounded-md">
              <p className="text-sm text-gray-300">
                Total Value:{' '}
                <span className="font-semibold text-blue-300">
                  {(parseFloat(formData.price) * parseFloat(formData.units)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{' '}
                  {formData.currency}
                </span>
              </p>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-500/10 border border-red-400/30 rounded-md">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errors.submit}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting 
                ? (initialPrice ? 'Updating...' : 'Adding...')
                : (initialPrice ? 'Update Holding' : 'Add Holding')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomHoldingDialog;

