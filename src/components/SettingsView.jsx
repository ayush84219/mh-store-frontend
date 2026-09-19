import React, { useState } from 'react';
import { Settings, ShieldAlert, PlusCircle, Trash2, Globe, Users, User, Edit, Package, Search } from 'lucide-react';

export default function SettingsView({
  vendors,
  onAddVendor,
  onDeleteVendor,
  currencySymbol,
  setCurrencySymbol,
  defaultTax,
  setDefaultTax,
  onResetDatabase,
  accessoriesList = [],
  onAddAccessory,
  onDeleteAccessory,
  designersList = [],
  onAddDesigner,
  onDeleteDesigner,
  materials = [],
  onAddMaterial,
  onDeleteMaterial,
  onUpdateMaterial,
  racks = [],
  setRacks,
  halls = [],
  setHalls
}) {
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [materialsJoined, setMaterialsJoined] = useState('Fabrics & Trims');
  const [vendorError, setVendorError] = useState('');



  // Raw Materials Catalog Management States
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [matSearchQuery, setMatSearchQuery] = useState('');
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState('Fabric');
  const [matStock, setMatStock] = useState('');
  const [matUnit, setMatUnit] = useState('meters');
  const [matCost, setMatCost] = useState('');
  const [matThreshold, setMatThreshold] = useState('50');
  const [matColor, setMatColor] = useState('');
  const [matLocation, setMatLocation] = useState('');
  const [matError, setMatError] = useState('');

  // Filter materials based on Search input
  const filteredMaterials = (materials || []).filter(m => {
    const q = matSearchQuery.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.id || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.color || '').toLowerCase().includes(q) ||
      (m.location || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700' }}>System Settings & Configurations</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage textile accessories catalog, designers directory, suppliers, Google Sheets integration, and system reset utilities.</p>
      </div>

      <div className="split-view" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
        {/* Left Column: System Configurations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Garment Accessories Catalog Configurations */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h3 className="panel-title">
                <Settings size={18} className="text-accent" />
                Garment Accessories Catalog ({accessoriesList.length})
              </h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
              Define the default catalog of garment accessories. These will automatically appear as options in the Below of Material builder checklist.
            </p>

            <div style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              padding: '8px',
              backgroundColor: 'var(--bg-primary)',
              marginBottom: '12px'
            }}>
              {accessoriesList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px', textAlign: 'center' }}>
                  No accessories cataloged. Add one below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {accessoriesList.map((acc) => (
                    <div
                      key={acc}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--accent-light)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{acc}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteAccessory(acc)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove ${acc} permanently`}
                      >
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.elements.newAccName;
                if (input.value && input.value.trim()) {
                  onAddAccessory(input.value.trim());
                  input.value = '';
                }
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                name="newAccName"
                className="form-input"
                placeholder="e.g. Drawstring, Metal Eyelets"
                style={{ flexGrow: 1, height: '36px', fontSize: '13px' }}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}>
                <PlusCircle size={14} /> Add
              </button>
            </form>
          </div>

          {/* Designers Directory Configurations */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h3 className="panel-title">
                <User size={18} className="text-accent" />
                Designers Directory ({designersList.length})
              </h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
              Manage system designer names. These options will populate the Designer In-charge dropdown in the Below of Material form.
            </p>

            <div style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              padding: '8px',
              backgroundColor: 'var(--bg-primary)',
              marginBottom: '12px'
            }}>
              {designersList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px', textAlign: 'center' }}>
                  No designers registered. Add one below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {designersList.map((designerName) => (
                    <div
                      key={designerName}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--accent-light)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{designerName}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteDesigner(designerName)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove ${designerName}`}
                      >
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.elements.newDesignerName;
                if (input.value && input.value.trim()) {
                  onAddDesigner(input.value.trim());
                  input.value = '';
                }
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                name="newDesignerName"
                className="form-input"
                placeholder="e.g. Jane Doe, John Smith"
                style={{ flexGrow: 1, height: '36px', fontSize: '13px' }}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}>
                <PlusCircle size={14} /> Add
              </button>
            </form>
          </div>



          {/* Database maintenance */}
          <div className="panel" style={{ border: '1px solid var(--danger)', backgroundColor: 'var(--danger-light)', marginBottom: 0 }}>
            <div className="panel-header" style={{ borderBottom: '1px solid var(--danger)' }}>
              <h3 className="panel-title" style={{ color: 'var(--danger)' }}>
                <ShieldAlert size={18} />
                Critical Actions (System Reset)
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: '16px', fontWeight: '500' }}>
              Warning: Resetting the database will delete all local custom designs, purchase orders, catalog changes, and vendor additions, restoring the default mock datasets.
            </p>

            <button className="btn btn-danger" onClick={onResetDatabase} style={{ width: '100%' }}>
              Wipe Database & Restore Defaults
            </button>
          </div>
        </div>

        {/* Right Column: Suppliers Management */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 className="panel-title">
              <Users size={18} className="text-accent" />
              Associated Suppliers & Vendors ({vendors.length})
            </h3>
            {!isAddingVendor && (
              <button className="btn btn-primary btn-sm" onClick={() => { setIsAddingVendor(true); setVendorError(''); }}>
                <PlusCircle size={14} /> Add Vendor
              </button>
            )}
          </div>

          {isAddingVendor && (
            <form onSubmit={handleAddVendor} className="animate-scale" style={{ marginBottom: '20px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-main)', textTransform: 'uppercase' }}>New Vendor Information</h4>
              {vendorError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                  <span>{vendorError}</span>
                </div>
              )}

              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Supplier Company Name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="email"
                  className="form-input"
                  placeholder="Contact Email Address"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Office/Factory Address"
                  value={vendorAddress}
                  onChange={(e) => setVendorAddress(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Materials Supplied</label>
                <select
                  className="form-input"
                  value={materialsJoined}
                  onChange={(e) => setMaterialsJoined(e.target.value)}
                >
                  <option value="Fabrics & Yarn">Fabrics & Yarn</option>
                  <option value="Metal Buttons & Rivets">Buttons, Zippers & Trims</option>
                  <option value="Labels, Tags & Hangers">Labels, Tags & Hangers</option>
                  <option value="Full Apparel Accessories">Full Apparel Accessories</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAddingVendor(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Add Vendor</button>
              </div>
            </form>
          )}

          <div className="custom-table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong style={{ display: 'block', fontSize: '14px' }}>{v.name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.email}</span>
                    </td>
                    <td>
                      <span className="status-badge" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '11px' }}>
                        {v.materialsJoined}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDeleteVendor(v.id)}
                        disabled={vendors.length <= 2} // keep at least a couple default vendors
                        style={{ padding: '6px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Raw Materials Catalog Configuration */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="panel-title">
            <Package size={18} className="text-accent" />
            Raw Materials Inventory Database ({materials.length})
          </h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setIsAddingMaterial(true);
              setMatName('');
              setMatCategory('Fabric');
              setMatStock('');
              setMatUnit('meters');
              setMatCost('');
              setMatThreshold('50');
              setMatColor('');
              setMatLocation('');
              setMatError('');
            }}
          >
            <PlusCircle size={14} /> Add Raw Material
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
          View, edit details, or delete raw materials from the active inventory database. Changes will update stock valuations and BOM calculations in real-time.
        </p>

        {/* Search bar inside Settings for materials */}
        <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '350px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search raw materials catalog..."
            value={matSearchQuery}
            onChange={(e) => setMatSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '34px', fontSize: '13px' }}
          />
        </div>

        <div className="custom-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Material Name</th>
                <th>Category</th>
                <th>Stock Level</th>

                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No raw materials match your search query.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>{m.id}</td>
                    <td>
                      <strong style={{ display: 'block', fontSize: '14px' }}>{m.name}</strong>
                      {m.color && m.color !== 'Default' && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Color: {m.color}</span>
                      )}
                      {m.location && m.location !== 'Default' && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Location: {m.location}</span>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{m.category}</td>
                    <td>
                      <span style={{
                        fontWeight: '700',
                        color: m.stock <= m.threshold ? 'var(--danger)' : 'var(--text-main)'
                      }}>
                        {m.stock} {m.unit}
                      </span>
                      {m.stock <= m.threshold && (
                        <span style={{
                          marginLeft: '6px', fontSize: '10px', fontWeight: '700',
                          backgroundColor: 'var(--danger-light)', color: 'var(--danger)',
                          padding: '2px 6px', borderRadius: '4px'
                        }}>
                          LOW STOCK
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingMaterial(m);
                            setMatName(m.name);
                            setMatCategory(m.category);
                            setMatStock(m.stock);
                            setMatUnit(m.unit);
                            setMatCost(m.cost);
                            setMatThreshold(m.threshold || 50);
                            setMatColor(m.color || '');
                            setMatLocation(m.location || '');
                            setMatError('');
                          }}
                          style={{ padding: '6px' }}
                          title="Edit material details"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete material "${m.name}"?`)) {
                              onDeleteMaterial(m.id);
                            }
                          }}
                          style={{ padding: '6px' }}
                          title="Delete material from database"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Material Details Modal */}
      {editingMaterial && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={20} style={{ color: 'var(--accent-color)' }} />
                <span>Edit Material Details</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingMaterial(null)}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit}>
              {matError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                  <span>{matError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Material Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Category</label>
                  <select
                    className="form-input"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                  >
                    <option value="Fabric">Fabric (Cotton, Denim, Silk)</option>
                    <option value="Trim">Trim (Zippers, Buttons, Rivets)</option>
                    <option value="Accessory">Accessory (Labels, Tags, Hangers)</option>
                    <option value="Packaging">Packaging (Poly bags, Cartons)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={matStock}
                    onChange={(e) => setMatStock(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select
                    className="form-input"
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                  >
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                    <option value="rolls">Rolls</option>
                    <option value="pieces">Pieces</option>
                    <option value="kg">Kgs</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Unit Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={matCost}
                    onChange={(e) => setMatCost(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Critical Reorder Threshold (Min Qty)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={matThreshold}
                    onChange={(e) => setMatThreshold(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Color / Style Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matColor}
                    onChange={(e) => setMatColor(e.target.value)}
                    placeholder="e.g. Bleached Dark Blue, Matte Gold"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Location Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matLocation}
                    onChange={(e) => setMatLocation(e.target.value)}
                    placeholder="e.g. Hall 1 Rack 2, Main Store"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingMaterial(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Raw Material Modal */}
      {isAddingMaterial && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} style={{ color: 'var(--accent-color)' }} />
                <span>Add Raw Material to Catalog</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAddingMaterial(false)}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddMatSubmit}>
              {matError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                  <span>{matError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Material Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Indigo Denim Raw Roll"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Category</label>
                  <select
                    className="form-input"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                  >
                    <option value="Fabric">Fabric (Cotton, Denim, Silk)</option>
                    <option value="Trim">Trim (Zippers, Buttons, Rivets)</option>
                    <option value="Accessory">Accessory (Labels, Tags, Hangers)</option>
                    <option value="Packaging">Packaging (Poly bags, Cartons)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="0"
                    value={matStock}
                    onChange={(e) => setMatStock(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select
                    className="form-input"
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                  >
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                    <option value="rolls">Rolls</option>
                    <option value="pieces">Pieces</option>
                    <option value="kg">Kgs</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Unit Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 15.50"
                    value={matCost}
                    onChange={(e) => setMatCost(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Critical Reorder Threshold (Min Qty)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="50"
                    value={matThreshold}
                    onChange={(e) => setMatThreshold(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Color / Style Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bleached Dark Blue, Matte Gold"
                    value={matColor}
                    onChange={(e) => setMatColor(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Location Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Hall 1 Rack 2, Main Store"
                    value={matLocation}
                    onChange={(e) => setMatLocation(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddingMaterial(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Catalog Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
